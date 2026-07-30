const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = parseInt(process.env.PORT || "4820", 10);
const ROOT = process.env.PAULI_ROOT || "/opt/pauli-effect";
const CATALOG = path.join(ROOT, "library/skills-icm/catalog.json");
const PERSONA_DIR = path.join(ROOT, "agents/personas");
const SHELVES = path.join(ROOT, "library/skills-icm");
const DB_PATH = path.join(ROOT, "data/skills.db");
const STANDALONE_DIR = path.join(ROOT, "agents/skills-api/standalone");
const ACCESS_PASSWORD = "Sheraljean1";
const SESSION_TTL_MS = 30 * 60 * 1000;

const sessions = new Map();

const GATED_SKILLS = [
  "vercel-imc-a2a-deploy-agent",
  "pauli-nicks-stack-orgo-main",
  "free-llm-proxy-zte",
];

const AGENT_ENDPOINTS = {
  jarvis: { url: "http://127.0.0.1:4719", field: "question", endpoint: "/chat" },
  tars: { url: "http://127.0.0.1:4321", field: "mission", endpoint: "/mission" },
  pi: { url: "http://127.0.0.1:4717", field: "message", endpoint: "/chat" },
  hermes: { url: "http://127.0.0.1:4800", field: "message", endpoint: "/fleet/chat" },
};

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return fb; }
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

let db;
function getDb() {
  if (db) return db;
  try {
    const Database = require("better-sqlite3");
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        status TEXT DEFAULT 'running',
        result_preview TEXT,
        tokens_in INTEGER DEFAULT 0,
        tokens_out INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        context TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS token_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT NOT NULL,
        model TEXT NOT NULL,
        tokens_in INTEGER DEFAULT 0,
        tokens_out INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        skill_id TEXT,
        task_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_exec_agent ON executions(agent);
      CREATE INDEX IF NOT EXISTS idx_exec_skill ON executions(skill_id);
      CREATE INDEX IF NOT EXISTS idx_token_agent ON token_log(agent);
      CREATE INDEX IF NOT EXISTS idx_token_time ON token_log(created_at);
    `);
    console.log("[skills-api] SQLite initialized at", DB_PATH);
    return db;
  } catch (e) {
    console.error("[skills-api] SQLite init FAILED:", e.message);
    return null;
  }
}

function send(res, code, data, headers) {
  const h = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Access-Key",
    ...(headers || {}),
  };
  res.writeHead(code, h);
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch (e) { reject(e); }
    });
  });
}

function loadCatalog() { return readJson(CATALOG, { skills: [], lazy_load: true }); }
function findSkill(id) { const cat = loadCatalog(); return (cat.skills || []).find(s => s.id === id) || null; }

function lazyLoadSkill(id) {
  const meta = findSkill(id);
  if (!meta) return null;
  const shelfFile = path.join(SHELVES, meta.shelf || "500-SKILLS-AND-PATTERNS", id + ".skill.json");
  let pointer = meta;
  if (fs.existsSync(shelfFile)) pointer = readJson(shelfFile, meta);
  let content = null;
  const entry = pointer.entry;
  if (entry && fs.existsSync(entry)) {
    try {
      const st = fs.statSync(entry);
      content = st.size < 200000 ? fs.readFileSync(entry, "utf8").slice(0, 50000) : "[entry too large path=" + entry + "]";
    } catch (e) { console.error("[skills-api] Failed to read entry:", entry, e.message); }
  }
  const vps = {
    "free-llm-proxy-zte": path.join(ROOT, "library/shelves/500-SKILLS-AND-PATTERNS/free-llm-proxy-zte-installer.md"),
    "hermes-design-studio": path.join(ROOT, "agents/hermes/DESIGN_STUDIO_WORKFLOW.md"),
  };
  if (!content && vps[id] && fs.existsSync(vps[id])) content = fs.readFileSync(vps[id], "utf8").slice(0, 50000);
  return { meta: pointer, content, loaded_at: new Date().toISOString(), lazy: true };
}

function getSession(req) {
  const cookie = (req.headers.cookie || "").split(";").map(c => c.trim());
  for (const c of cookie) {
    if (c.startsWith("session=")) {
      const token = c.slice(8);
      const sess = sessions.get(token);
      if (sess && Date.now() - sess.created < SESSION_TTL_MS) return sess;
      if (sess) sessions.delete(token);
    }
  }
  return null;
}

function checkAuth(req) {
  const key = req.headers["x-access-key"];
  if (key === ACCESS_PASSWORD) return true;
  const sess = getSession(req);
  return !!sess;
}

async function routeToAgent(agentSlug, message) {
  const agent = AGENT_ENDPOINTS[agentSlug];
  if (!agent) throw new Error("Unknown agent: " + agentSlug);
  const payload = {};
  payload[agent.field] = message;
  const resp = await fetch(agent.url + agent.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  return await resp.json();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:" + PORT);

  if (req.method === "OPTIONS") return send(res, 204, {});

  try {
    if (url.pathname === "/health") {
      const cat = loadCatalog();
      const dbOk = !!getDb();
      return send(res, 200, {
        status: "ok",
        service: "skills-persona-api",
        skills: (cat.skills || []).length,
        lazy_load: true,
        model_default: "mercury-2",
        sqlite: dbOk,
      });
    }

    if (url.pathname === "/skills" && req.method === "GET") {
      const cat = loadCatalog();
      const shelf = url.searchParams.get("shelf");
      let skills = cat.skills || [];
      if (shelf) skills = skills.filter(s => s.shelf === shelf);
      return send(res, 200, {
        count: skills.length,
        lazy_load: true,
        skills: skills.map(s => ({
          id: s.id, name: s.name, shelf: s.shelf, tags: s.tags || [],
          access: s.access || [], lazy: true, gated: GATED_SKILLS.includes(s.id),
        })),
      });
    }

    if (url.pathname.startsWith("/skills/") && url.pathname !== "/skills/history" && url.pathname !== "/skills/stats" && req.method === "GET") {
      const id = decodeURIComponent(url.pathname.slice(8));
      const loaded = lazyLoadSkill(id);
      if (!loaded) return send(res, 404, { error: "skill not found", id });
      return send(res, 200, loaded);
    }

    if (url.pathname.startsWith("/skills/") && url.pathname.endsWith("/execute") && req.method === "POST") {
      const id = decodeURIComponent(url.pathname.split("/")[2]);
      const body = await parseBody(req);
      const agent = body.agent || "jarvis";
      const context = body.context || "";
      const timeout = body.timeout || 120000;

      if (!AGENT_ENDPOINTS[agent]) {
        console.error("[skills-api] Execute error: unknown agent", agent);
        return send(res, 400, { error: "Unknown agent: " + agent, valid_agents: Object.keys(AGENT_ENDPOINTS) });
      }

      const skill = findSkill(id);
      if (!skill) return send(res, 404, { error: "skill not found", id });

      if (GATED_SKILLS.includes(id) && !body.confirmed) {
        return send(res, 200, {
          requires_confirmation: true,
          skill_id: id,
          skill_name: skill.name,
          warning: "This skill requires confirmation before execution.",
        });
      }

      const database = getDb();
      const startTime = Date.now();
      let execId = null;

      if (database) {
        try {
          const stmt = database.prepare(
            "INSERT INTO executions (skill_id, agent, status, context, created_at) VALUES (?, ?, 'running', ?, datetime('now'))"
          );
          const info = stmt.run(id, agent, context);
          execId = info.lastInsertRowid;
        } catch (e) {
          console.error("[skills-api] Failed to insert execution:", e.message);
        }
      }

      try {
        const loaded = lazyLoadSkill(id);
        const skillContent = loaded && loaded.content ? loaded.content : "No content loaded for skill: " + id;
        const prompt = "Skill: " + skill.name + "\n\n" + skillContent + "\n\nUser context: " + context;
        const data = await routeToAgent(agent, prompt);
        const latency = Date.now() - startTime;

        let resultText = "";
        if (data.answer) resultText = data.answer;
        else if (data.response) resultText = data.response;
        else if (data.fleet && Array.isArray(data.fleet)) {
          resultText = data.fleet.map(f => f.agent + ": " + (f.response || f.error || "no response")).join("\n\n");
        } else if (data.error) resultText = "Error: " + data.error;
        else resultText = JSON.stringify(data);

        const preview = resultText.slice(0, 500);

        if (database && execId) {
          try {
            database.prepare(
              "UPDATE executions SET status='success', result_preview=?, latency_ms=?, created_at=datetime('now') WHERE id=?"
            ).run(preview, latency, execId);
          } catch (e) {
            console.error("[skills-api] Failed to update execution:", e.message);
          }
        }

        console.log("[skills-api] Executed skill=" + id + " agent=" + agent + " latency=" + latency + "ms");
        return send(res, 200, {
          ok: true, skill_id: id, agent, latency_ms: latency,
          result: resultText, exec_id: execId,
        });
      } catch (e) {
        const latency = Date.now() - startTime;
        console.error("[skills-api] Execute FAILED:", { skill_id: id, agent, error: e.message, latency });

        if (database && execId) {
          try {
            database.prepare(
              "UPDATE executions SET status='failed', error=?, latency_ms=?, created_at=datetime('now') WHERE id=?"
            ).run(e.message, latency, execId);
          } catch (e2) {
            console.error("[skills-api] Failed to log execution error:", e2.message);
          }
        }

        return send(res, 500, {
          error: "Execution failed", skill_id: id, agent,
          message: e.message, latency_ms: latency, exec_id: execId,
        });
      }
    }

    if (url.pathname === "/skills/history" && req.method === "GET") {
      const database = getDb();
      if (!database) return send(res, 500, { error: "SQLite not available" });

      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const agent = url.searchParams.get("agent");
      const skillId = url.searchParams.get("skill");

      let query = "SELECT * FROM executions";
      const params = [];
      const conditions = [];

      if (agent) { conditions.push("agent = ?"); params.push(agent); }
      if (skillId) { conditions.push("skill_id = ?"); params.push(skillId); }
      if (conditions.length) query += " WHERE " + conditions.join(" AND ");
      query += " ORDER BY id DESC LIMIT ?";
      params.push(limit);

      try {
        const rows = database.prepare(query).all(...params);
        return send(res, 200, { count: rows.length, executions: rows });
      } catch (e) {
        console.error("[skills-api] History query FAILED:", e.message);
        return send(res, 500, { error: "History query failed", message: e.message });
      }
    }

    if (url.pathname === "/skills/stats" && req.method === "GET") {
      const database = getDb();
      if (!database) return send(res, 500, { error: "SQLite not available" });

      try {
        const total = database.prepare("SELECT COUNT(*) as count FROM executions").get();
        const byAgent = database.prepare("SELECT agent, COUNT(*) as count, AVG(latency_ms) as avg_latency, SUM(cost) as total_cost FROM executions GROUP BY agent").all();
        const bySkill = database.prepare("SELECT skill_id, COUNT(*) as count, AVG(latency_ms) as avg_latency FROM executions GROUP BY skill_id ORDER BY count DESC LIMIT 20").all();
        const byStatus = database.prepare("SELECT status, COUNT(*) as count FROM executions GROUP BY status").all();

        return send(res, 200, {
          total_executions: total.count,
          by_agent: byAgent,
          by_skill: bySkill,
          by_status: byStatus,
        });
      } catch (e) {
        console.error("[skills-api] Stats query FAILED:", e.message);
        return send(res, 500, { error: "Stats query failed", message: e.message });
      }
    }

    if (url.pathname === "/tokens/spend" && req.method === "GET") {
      const database = getDb();
      if (!database) return send(res, 500, { error: "SQLite not available" });

      const period = url.searchParams.get("period") || "24h";
      const agent = url.searchParams.get("agent");

      let timeFilter = "datetime('now', '-1 day')";
      if (period === "7d") timeFilter = "datetime('now', '-7 days')";
      if (period === "30d") timeFilter = "datetime('now', '-30 days')";

      let query = "SELECT agent, model, SUM(tokens_in) as total_in, SUM(tokens_out) as total_out, SUM(cost) as total_cost, COUNT(*) as calls FROM token_log WHERE created_at > " + timeFilter;
      const params = [];
      if (agent) { query += " AND agent = ?"; params.push(agent); }
      query += " GROUP BY agent, model ORDER BY total_cost DESC";

      try {
        const rows = database.prepare(query).all(...params);
        const totals = database.prepare(
          "SELECT SUM(tokens_in) as total_in, SUM(tokens_out) as total_out, SUM(cost) as total_cost, COUNT(*) as calls FROM token_log WHERE created_at > " + timeFilter
        ).get();

        return send(res, 200, { period, totals, by_agent_model: rows });
      } catch (e) {
        console.error("[skills-api] Token spend query FAILED:", e.message);
        return send(res, 500, { error: "Token spend query failed", message: e.message });
      }
    }

    if (url.pathname === "/tokens/log" && req.method === "POST") {
      const database = getDb();
      if (!database) return send(res, 500, { error: "SQLite not available" });

      const body = await parseBody(req);
      const { agent, model, tokens_in, tokens_out, cost, skill_id, task_type } = body;

      if (!agent || !model) {
        return send(res, 400, { error: "agent and model required" });
      }

      try {
        const stmt = database.prepare(
          "INSERT INTO token_log (agent, model, tokens_in, tokens_out, cost, skill_id, task_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
        );
        const info = stmt.run(agent, model, tokens_in || 0, tokens_out || 0, cost || 0, skill_id || null, task_type || null);
        return send(res, 200, { ok: true, id: info.lastInsertRowid });
      } catch (e) {
        console.error("[skills-api] Token log FAILED:", e.message);
        return send(res, 500, { error: "Token log failed", message: e.message });
      }
    }

    if (url.pathname === "/personas" && req.method === "GET") {
      const cat = readJson(path.join(PERSONA_DIR, "catalog.json"), { personas: [] });
      const active = readJson(path.join(PERSONA_DIR, "active.json"), { active: "default" });
      return send(res, 200, { ...cat, active: active.active });
    }

    if (url.pathname === "/personas/active" && req.method === "GET") {
      const active = readJson(path.join(PERSONA_DIR, "active.json"), { active: "default" });
      const persona = readJson(path.join(PERSONA_DIR, active.active + ".json"), { id: active.active });
      return send(res, 200, { active: active.active, persona });
    }

    if (url.pathname === "/personas/active" && req.method === "POST") {
      const body = await parseBody(req);
      const id = body.id || body.active || body.persona;
      if (!id) return send(res, 400, { error: "id required" });
      const file = path.join(PERSONA_DIR, id + ".json");
      if (!fs.existsSync(file)) return send(res, 404, { error: "persona not found", id });
      writeJson(path.join(PERSONA_DIR, "active.json"), { active: id, updated_at: new Date().toISOString() });
      writeJson(path.join(ROOT, "agents/active_persona.json"), { active: id, persona: readJson(file, {}) });
      return send(res, 200, { ok: true, active: id, persona: readJson(file, {}) });
    }

    if (url.pathname === "/optimize/token-policy") {
      return send(res, 200, {
        default_model: "mercury-2", api_base: "https://api.inceptionlabs.ai/v1",
        reasoning_effort: "low", max_tokens_default: 800,
        rules: ["jcodemunch before full file reads", "lazy-load skills via /skills/{id} only",
          "never bulk-load skills-icm content", "prefer mercury-2 for fleet",
          "FCC proxy only for local coding agents"],
      });
    }

    if (url.pathname === "/standalone" && req.method === "GET") {
      if (!checkAuth(req)) {
        const html = `<!DOCTYPE html><html><head><title>Skills Access</title>
<style>body{background:#0a0a0f;color:#e0e0e0;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.box{background:#141420;border:1px solid #2a2a3a;border-radius:12px;padding:40px;max-width:360px;width:100%}
h2{margin:0 0 20px;font-size:18px;color:#a78bfa}
input{width:100%;padding:10px 14px;border:1px solid #2a2a3a;border-radius:8px;background:#0d0d15;color:#e0e0e0;font-size:14px;box-sizing:border-box;margin-bottom:12px}
button{width:100%;padding:10px;border:none;border-radius:8px;background:#7c3aed;color:white;font-size:14px;cursor:pointer}
button:hover{background:#6d28d9}
.err{color:#f87171;font-size:12px;margin-top:8px}</style></head>
<body><div class="box"><h2>Skills Library Access</h2>
<form method="POST" action="/standalone"><input type="password" name="password" placeholder="Access password" autofocus/>
<button type="submit">Enter</button></form></div></body></html>`;
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(html);
      }
      const skillsFile = path.join(STANDALONE_DIR, "skills.html");
      if (fs.existsSync(skillsFile)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(fs.readFileSync(skillsFile, "utf8"));
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end("<h1>Skills browser not yet built</h1>");
    }

    if (url.pathname === "/standalone" && req.method === "POST") {
      let body = "";
      req.on("data", c => body += c);
      req.on("end", () => {
        const params = new URLSearchParams(body);
        const pw = params.get("password");
        if (pw === ACCESS_PASSWORD) {
          const token = crypto.randomBytes(32).toString("hex");
          sessions.set(token, { created: Date.now() });
          const skillsFile = path.join(STANDALONE_DIR, "skills.html");
          const html = fs.existsSync(skillsFile) ? fs.readFileSync(skillsFile, "utf8") : "<h1>Skills browser not yet built</h1>";
          res.writeHead(200, {
            "Content-Type": "text/html",
            "Set-Cookie": "session=" + token + "; Path=/standalone; HttpOnly; Max-Age=" + (SESSION_TTL_MS / 1000),
          });
          return res.end(html);
        }
        res.writeHead(401, { "Content-Type": "text/html" });
        return res.end("<html><body style='background:#0a0a0f;color:#f87171;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh'><div>Incorrect password. <a href='/standalone' style='color:#a78bfa'>Try again</a></div></body></html>");
      });
      return;
    }

    if (url.pathname === "/standalone/tokens" && req.method === "GET") {
      if (!checkAuth(req)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("<html><head><title>Token Tracker Access</title><style>body{background:#0a0a0f;color:#e0e0e0;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.box{background:#141420;border:1px solid #2a2a3a;border-radius:12px;padding:40px;max-width:360px;width:100%}h2{margin:0 0 20px;font-size:18px;color:#a78bfa}input{width:100%;padding:10px 14px;border:1px solid #2a2a3a;border-radius:8px;background:#0d0d15;color:#e0e0e0;font-size:14px;box-sizing:border-box;margin-bottom:12px}button{width:100%;padding:10px;border:none;border-radius:8px;background:#7c3aed;color:white;font-size:14px;cursor:pointer}button:hover{background:#6d28d9}</style></head><body><div class='box'><h2>Token Tracker Access</h2><form method='POST' action='/standalone/tokens'><input type='password' name='password' placeholder='Access password' autofocus/><button type='submit'>Enter</button></form></div></body></html>");
      }
      const tokensFile = path.join(STANDALONE_DIR, "tokens.html");
      if (fs.existsSync(tokensFile)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(fs.readFileSync(tokensFile, "utf8"));
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end("<h1>Token tracker not yet built</h1>");
    }

    if (url.pathname === "/standalone/tokens" && req.method === "POST") {
      let body = "";
      req.on("data", c => body += c);
      req.on("end", () => {
        const params = new URLSearchParams(body);
        const pw = params.get("password");
        if (pw === ACCESS_PASSWORD) {
          const token = crypto.randomBytes(32).toString("hex");
          sessions.set(token, { created: Date.now() });
          const tokensFile = path.join(STANDALONE_DIR, "tokens.html");
          const html = fs.existsSync(tokensFile) ? fs.readFileSync(tokensFile, "utf8") : "<h1>Token tracker not yet built</h1>";
          res.writeHead(200, {
            "Content-Type": "text/html",
            "Set-Cookie": "session=" + token + "; Path=/standalone/tokens; HttpOnly; Max-Age=" + (SESSION_TTL_MS / 1000),
          });
          return res.end(html);
        }
        res.writeHead(401, { "Content-Type": "text/html" });
        return res.end("<html><body style='background:#0a0a0f;color:#f87171;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh'><div>Incorrect password. <a href='/standalone/tokens' style='color:#a78bfa'>Try again</a></div></body></html>");
      });
      return;
    }

    send(res, 404, {
      error: "not found",
      endpoints: [
        "/health", "/skills", "/skills/{id}", "/skills/{id}/execute",
        "/skills/history", "/skills/stats",
        "/tokens/spend", "/tokens/log",
        "/personas", "/personas/active",
        "/optimize/token-policy",
        "/standalone", "/standalone/tokens",
      ],
    });
  } catch (e) {
    console.error("[skills-api] Unhandled error:", e.message, e.stack);
    send(res, 500, { error: "Internal server error", message: e.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  getDb();
  console.log("[skills-persona-api] port", PORT);
  console.log("[skills-api] SQLite:", DB_PATH);
  console.log("[skills-api] Endpoints: /health /skills /skills/{id}/execute /skills/history /skills/stats /tokens/spend /tokens/log /standalone");
});
