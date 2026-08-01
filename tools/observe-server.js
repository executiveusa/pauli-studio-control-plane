/**
 * Pauli Effect — Observation API
 * Single-file Node service (stdlib only). Polls the 5 live agent endpoints
 * every POLL_MS, caches state, exposes REST snapshots + an SSE stream that
 * the Vercel dashboard + open-molt theater subscribe to.
 *
 * Port 4840. Proxied by Caddy at /observe/*. Tailscale-gated via shared secret.
 *
 * Endpoints:
 *   GET  /status    — snapshot of all agents (health + model + uptime + mission)
 *   GET  /missions  — recent mission history (from /opt/pauli-effect/missions/)
 *   GET  /tokens    — token spend (from Skills API)
 *   GET  /feed      — recent event log (JSONL tail)
 *   GET  /stream    — SSE: pushes an event on every state change
 *   POST /council   — (Phase E) fan-out council deliberation
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "4840", 10);
const POLL_MS = parseInt(process.env.POLL_MS || "3000", 10);
const SHARED_SECRET = process.env.OBSERVE_SECRET || "pauli-observe-tailnet-2026";
const MISSIONS_DIR = process.env.MISSIONS_DIR || "/opt/pauli-effect/missions";
const EVENTS_LOG = path.join(__dirname, "events.jsonl");

// --- Agent registry: the 5 endpoints we poll ---
const AGENTS = [
  { slug: "pi",     name: "Pi (Cosmos)",        role: "Engineering Lead",   url: "http://127.0.0.1:4717", publicPath: "/cosmos" },
  { slug: "tars",   name: "TARS",                role: "Builder",            url: "http://127.0.0.1:4321", publicPath: "/tars" },
  { slug: "hermes", name: "Hermes",              role: "Orchestrator",       url: "http://127.0.0.1:4800", publicPath: "/hermes" },
  { slug: "jarvis", name: "JARVIS (Cosmos-II)",  role: "Brain Keeper",       url: "http://127.0.0.1:4719", publicPath: "/cosmos-ii" },
];
const SKILLS_API = "http://127.0.0.1:4820";
const FLEET_API  = "http://127.0.0.1:4810";
const OMNIROUTE   = "http://127.0.0.1:20128";

// --- In-memory cache ---
let cache = { agents: {}, tokens: null, fleet: null, models: [], updatedAt: 0 };
let sseClients = [];

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function fetchJson(url, timeoutMs = 3000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Hash a state object to detect changes (avoid spamming SSE when nothing changed)
function stateHash(agent) {
  return JSON.stringify({
    s: agent.status, m: agent.model, u: agent.uptime,
    cm: agent.currentMission, mn: agent.missionsCompleted,
  });
}

function pushEvent(type, data) {
  const evt = { type, data, ts: Date.now() };
  // append to rolling log
  try { fs.appendFileSync(EVENTS_LOG, JSON.stringify(evt) + "\n"); } catch {}
  // broadcast to SSE clients
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}

async function pollOnce() {
  const newAgents = {};
  for (const a of AGENTS) {
    const health = await fetchJson(`${a.url}/health`);
    const prev = cache.agents[a.slug];
    const agent = {
      slug: a.slug, name: a.name, role: a.role, publicPath: a.publicPath,
      status: health?.status || "offline",
      model: health?.model || null,
      apiBase: health?.api_base || null,
      uptime: health?.uptime || 0,
      currentMission: health?.current_mission || null,
      missionsCompleted: health?.missions_completed || null,
      polledAt: Date.now(),
    };
    newAgents[a.slug] = agent;
    // emit change events
    if (prev && stateHash(prev) !== stateHash(agent)) {
      if (prev.status !== agent.status) {
        pushEvent("agent.status", { slug: a.slug, from: prev.status, to: agent.status });
      }
      if (prev.model !== agent.model) {
        pushEvent("agent.model", { slug: a.slug, from: prev.model, to: agent.model });
      }
      if (prev.currentMission !== agent.currentMission && agent.currentMission) {
        pushEvent("agent.mission", { slug: a.slug, mission: agent.currentMission });
      }
    }
  }
  cache.agents = newAgents;

  // Tokens + fleet + models (less frequently — every 5th poll)
  if (cache.updatedAt === 0 || Date.now() - cache.updatedAt > 15000) {
    const [tokens, fleet, models] = await Promise.all([
      fetchJson(`${SKILLS_API}/tokens/spend`),
      fetchJson(`${FLEET_API}/`),
      fetchJson(`${OMNIROUTE}/v1/models`),
    ]);
    cache.tokens = tokens;
    cache.fleet = fleet;
    cache.models = (models?.data || []).slice(0, 20).map(m => ({ id: m.id, tools: m.capabilities?.tool_calling }));
    cache.updatedAt = Date.now();
  }
}

// Scan missions dir for new mission files → emit "mission.created" events
let knownMissions = new Set();
async function scanMissions() {
  try {
    const files = fs.existsSync(MISSIONS_DIR)
      ? fs.readdirSync(MISSIONS_DIR).filter(f => f.startsWith("mission-") && f.endsWith(".json"))
      : [];
    for (const f of files) {
      if (knownMissions.has(f)) continue;
      knownMissions.add(f);
      try {
        const m = JSON.parse(fs.readFileSync(path.join(MISSIONS_DIR, f), "utf8"));
        // classify mission type for SimCity building kind
        const text = (m.mission || "").toLowerCase();
        let kind = "task";
        if (/research|investigate|explore|discover/.test(text)) kind = "research";
        else if (/draft|write|compose|create content|blog|email/.test(text)) kind = "draft";
        else if (/publish|post|deploy|ship|release/.test(text)) kind = "publish";
        else if (/fund|donor|grant|revenue|money/.test(text)) kind = "fundraise";
        else if (/video|podcast|audio|voice/.test(text)) kind = "media";
        else if (/design|ui|ux|landing|brand/.test(text)) kind = "design";
        else if (/build|implement|code|develop|app|website/.test(text)) kind = "build";
        pushEvent("mission.created", {
          id: m.id, agent: m.routed_to || m.agent_name, kind,
          mission: String(m.mission || "").slice(0, 200),
          result: m.result?.response ? String(m.result.response).slice(0, 300) : null,
          createdAt: m.created_at,
        });
      } catch {}
    }
    // keep set bounded
    if (knownMissions.size > 200) {
      knownMissions = new Set([...knownMissions].slice(-100));
    }
  } catch {}
}

// --- HTTP server ---
function sendJson(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data, null, 2));
}

function checkAuth(req) {
  // shared secret in header OR Tailscale-forwarded header
  const auth = req.headers["x-observe-secret"] || "";
  const tsUser = req.headers["x-tailscale-userlogin"] || "";
  if (auth === SHARED_SECRET) return true;
  if (tsUser && tsUser.includes("@")) return true;  // Tailscale sets this when funnel/serve proxies
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Observe-Secret,X-Tailscale-Userlogin",
    });
    return res.end();
  }

  // health is public (no auth)
  if (url.pathname === "/health") {
    return sendJson(res, 200, { status: "ok", service: "pauli-observe", uptime: process.uptime(), agents: AGENTS.length, sseClients: sseClients.length });
  }

  // everything else requires auth
  if (!checkAuth(req)) {
    return sendJson(res, 401, { error: "unauthorized", hint: "send X-Observe-Secret header" });
  }

  if (url.pathname === "/status") {
    return sendJson(res, 200, { ...cache, serverTime: new Date().toISOString() });
  }

  if (url.pathname === "/missions") {
    // tail of events log filtered to mission.created
    try {
      const lines = fs.existsSync(EVENTS_LOG) ? fs.readFileSync(EVENTS_LOG, "utf8").trim().split("\n").slice(-50) : [];
      const missions = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(e => e && e.type === "mission.created")
        .map(e => e.data)
        .reverse();
      return sendJson(res, 200, { missions, count: missions.length });
    } catch (e) { return sendJson(res, 500, { error: e.message }); }
  }

  if (url.pathname === "/tokens") {
    return sendJson(res, 200, cache.tokens || { note: "no token data yet" });
  }

  if (url.pathname === "/feed") {
    const since = parseInt(url.searchParams.get("since") || "0", 10);
    try {
      const lines = fs.existsSync(EVENTS_LOG) ? fs.readFileSync(EVENTS_LOG, "utf8").trim().split("\n").slice(-200) : [];
      const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(e => e && e.ts > since);
      return sendJson(res, 200, { events });
    } catch (e) { return sendJson(res, 500, { error: e.message }); }
  }

  if (url.pathname === "/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ msg: "observe stream open", agentCount: AGENTS.length })}\n\n`);
    // immediately push current snapshot
    res.write(`event: snapshot\ndata: ${JSON.stringify(cache)}\n\n`);
    sseClients.push(res);
    req.on("close", () => { sseClients = sseClients.filter(c => c !== res); });
    // heartbeat every 25s
    const hb = setInterval(() => { try { res.write(": hb\n\n"); } catch {} }, 25000);
    req.on("close", () => clearInterval(hb));
    return;
  }

  if (url.pathname === "/council" && req.method === "POST") {
    // Phase E placeholder — real council deliberation wired later
    return sendJson(res, 200, { note: "council endpoint ready — Phase E wires the 3-stage karpathy flow", topic: "TODO" });
  }

  // BRIDGE: LibreChat → laptop TARS visual reaction
  // POST /bridge {agent, message, response} — emits a "bridge.command" SSE event
  // that the laptop TARS subscriber listens for and reacts to visually.
  if (url.pathname === "/bridge" && req.method === "POST") {
    try {
      const body = await new Promise(r => { let b = ""; req.on("data", x => b += x); req.on("end", () => r(b)); });
      const cmd = JSON.parse(body);
      if (!cmd.agent || !cmd.message) {
        return sendJson(res, 400, { error: "agent and message required" });
      }
      pushEvent("bridge.command", {
        agent: cmd.agent,
        message: String(cmd.message).slice(0, 500),
        response: cmd.response ? String(cmd.response).slice(0, 1000) : null,
        source: cmd.source || "librechat",
        timestamp: new Date().toISOString(),
      });
      log(`bridge.command: agent=${cmd.agent} msg="${String(cmd.message).slice(0, 60)}..."`);
      return sendJson(res, 200, { ok: true, note: "command emitted to laptop subscribers" });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  return sendJson(res, 404, { error: "not found", endpoints: ["/health", "/status", "/missions", "/tokens", "/feed", "/stream", "/bridge"] });
});

server.listen(PORT, "127.0.0.1", () => {
  log(`Pauli Observation API on 127.0.0.1:${PORT} (poll every ${POLL_MS}ms, ${AGENTS.length} agents)`);
  // initial poll
  pollOnce().then(() => scanMissions()).then(() => log(`initial poll done — ${Object.values(cache.agents).filter(a=>a.status==="ok").length} agents online`));
  // polling loop
  setInterval(() => { pollOnce().catch(e => log("poll error: " + e.message)); }, POLL_MS);
  // mission scan every 10s
  setInterval(() => { scanMissions().catch(() => {}); }, 10000);
});
