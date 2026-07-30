/**
 * OpenAI-compatible adapter for The Pauli Effect fleet.
 * Translates /v1/chat/completions -> agent-specific endpoints.
 * Now with runtime model switching, recommendations, and token logging.
 *
 * Agents:
 *   jarvis (Cosmos-II)  -> POST /chat {question} -> {answer}
 *   tars  (TARS)        -> POST /mission {mission} -> {response}
 *   pi    (Cosmos)      -> POST /chat {message} -> {answer}
 *   hermes (Orchestrator) -> POST /fleet/chat {message, agent} -> {fleet[{agent, response}]}
 *   auto  -> routes to best agent via Hermes
 *
 * Model switching:
 *   GET  /api/models         - list current model assignments
 *   POST /api/models/switch  - {agent, model} switch agent's model
 *   GET  /api/models/available - available models list
 *   GET  /api/omniroute/health - check OmniRoute gateway health
 *   POST /api/recommend-model - {task, agent} get model recommendation
 *   GET  /api/model-suggestions - per-agent recommendations
 *   POST /api/tokens/log     - {agent, model, tokens_in, tokens_out, cost} log usage
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = parseInt(process.env.PORT || "4810", 10);

const HOST = process.env.AGENT_HOST || "host.docker.internal";
const CONFIG_PATH = path.join(process.env.HOME || "/root", ".fleet-models.json");
const SKILLS_API = process.env.SKILLS_API || "http://127.0.0.1:4820";

const AGENTS = {
  jarvis: { name: "Cosmos-II (Jarvis)", url: `http://${HOST}:4719`, field: "question", endpoint: "/chat" },
  tars:   { name: "TARS",               url: `http://${HOST}:4321`, field: "text",    endpoint: "/chat"     },
  pi:     { name: "Cosmos (Pi)",         url: `http://${HOST}:4717`, field: "message", endpoint: "/chat" },
  hermes: { name: "Hermes",              url: `http://${HOST}:4800`, field: "message", endpoint: "/fleet/chat" },
};

const AVAILABLE_MODELS = [
  { id: "mercury-2",      label: "Mercury-2 (Inception)",   provider: "inception", speed: "fast",  cost: "low" },
  { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", provider: "groq", speed: "fast", cost: "free" },
  { id: "groq/qwen/qwen3-32b",         label: "Qwen3 32B (Groq)",     provider: "groq", speed: "fast", cost: "free" },
  { id: "groq/meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout (Groq)", provider: "groq", speed: "fast", cost: "free" },
  { id: "groq/openai/gpt-oss-120b",    label: "GPT-OSS 120B (Groq)",  provider: "groq", speed: "medium", cost: "free" },
  { id: "openrouter/meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (OpenRouter)", provider: "openrouter", speed: "fast", cost: "free" },
  { id: "openrouter/openai/gpt-oss-20b:free", label: "GPT-OSS 20B (OpenRouter)", provider: "openrouter", speed: "fast", cost: "free" },
  { id: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra (OpenRouter)", provider: "openrouter", speed: "slow", cost: "free" },
  { id: "openrouter/nousresearch/hermes-3-llama-3.1-405b:free", label: "Hermes 3 405B (OpenRouter)", provider: "openrouter", speed: "slow", cost: "free" },
  { id: "auto",            label: "Auto (Best available)",   provider: "auto",    speed: "auto",  cost: "auto" },
  { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1 (OpenRouter)", provider: "openrouter", speed: "fast", cost: "low" },
];

const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "http://127.0.0.1:20128";

const TASK_CLASSIFICATION = {
  code: {
    keywords: ["refactor", "generate code", "implement", "debug", "fix bug", "write function", "create module", "add feature", "code review", "optimize code", "migrate", "deploy", "build"],
    recommended: "mercury-2",
    reason: "Best code quality",
    confidence: 0.9,
  },
  reason: {
    keywords: ["plan", "analyze", "reason", "decide", "architect", "design", "evaluate", "compare", "assess", "strategize", "think through"],
    recommended: "mercury-2",
    reason: "Highest reasoning capability",
    confidence: 0.9,
  },
  classify: {
    keywords: ["classify", "route", "check status", "list", "count", "is there", "filter", "sort", "organize", "categorize"],
    recommended: "groq/llama-3.3-70b-versatile",
    reason: "Free, fast, sufficient for classification",
    confidence: 0.8,
  },
  bulk: {
    keywords: ["summarize", "batch", "process data", "extract", "parse", "transform", "convert", "cleanup", "normalize"],
    recommended: "groq/qwen/qwen3-32b",
    reason: "Free, good for bulk data processing",
    confidence: 0.8,
  },
  creative: {
    keywords: ["write", "draft", "compose", "create content", "story", "copy", "blog", "email", "message", "marketing"],
    recommended: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
    reason: "Free, good for creative writing",
    confidence: 0.7,
  },
  search: {
    keywords: ["search", "lookup", "find", "research", "investigate", "explore", "discover"],
    recommended: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
    reason: "Free, fast for search/retrieval",
    confidence: 0.7,
  },
};

function classifyTask(task) {
  const lower = (task || "").toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const [type, config] of Object.entries(TASK_CLASSIFICATION)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { type, ...config };
    }
  }

  if (!bestMatch || bestScore === 0) {
    return { type: "default", recommended: "mercury-2", reason: "Safe default for unknown tasks", confidence: 0.5 };
  }
  return bestMatch;
}

function loadModelConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    const defaults = { jarvis: "mercury-2", tars: "mercury-2", pi: "mercury-2", hermes: "mercury-2" };
    saveModelConfig(defaults);
    return defaults;
  }
}

function saveModelConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function makeChatResponse(model, content, id) {
  return {
    id: id || "chatcmpl-" + Date.now(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{ index: 0, message: { role: "assistant", content: content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function extractContent(data) {
  if (data.answer) return data.answer;
  if (data.reply) return data.reply;
  if (data.response) return data.response;
  if (data.fleet && Array.isArray(data.fleet)) {
    return data.fleet.map(f => `**${f.agent}:** ${f.response || f.error || "no response"}`).join("\n\n");
  }
  if (data.error) return `Error: ${data.error}`;
  return JSON.stringify(data);
}

async function routeToAgent(agentSlug, message) {
  const agent = AGENTS[agentSlug];
  if (!agent) throw new Error(`Unknown agent: ${agentSlug}`);
  const payload = {};
  payload[agent.field] = message;

  const startTime = Date.now();
  try {
    const resp = await fetch(agent.url + agent.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error(`[FLEET-ADAPTER] Agent ${agentSlug} FAILED:`, {
      error: err.message,
      url: agent.url + agent.endpoint,
      latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}

async function logTokenUsage(agent, model, tokensIn, tokensOut, cost, skillId, taskType) {
  try {
    await fetch(SKILLS_API + "/tokens/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, model, tokens_in: tokensIn, tokens_out: tokensOut, cost, skill_id: skillId, task_type: taskType }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[FLEET-ADAPTER] Token log FAILED:", err.message);
  }
}

async function handleChat(body) {
  const messages = body.messages || [];
  const model = body.model || "mercury-2";
  const lastMsg = messages[messages.length - 1];
  const userMessage = lastMsg?.content || "";

  let agentSlug = "jarvis";
  const modelLower = (model || "").toLowerCase();

  for (const slug of Object.keys(AGENTS)) {
    if (modelLower.includes(slug)) { agentSlug = slug; break; }
  }

  if (modelLower === "auto" || modelLower === "fleet" || modelLower === "hermes") {
    agentSlug = "hermes";
  }

  try {
    const data = await routeToAgent(agentSlug, userMessage);
    const content = extractContent(data);
    // BRIDGE: mirror command to laptop TARS for visual reaction (fire-and-forget)
    if (agentSlug === "tars" || agentSlug === "pi" || agentSlug === "jarvis") {
      fetch("http://127.0.0.1:4840/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Observe-Secret": "pauli-observe-tailnet-2026" },
        body: JSON.stringify({ agent: agentSlug, message: userMessage, response: content, source: "librechat" }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => {});
    }
    const response = makeChatResponse(model, content);

    logTokenUsage(agentSlug, model, 0, 0, 0, null, "chat").catch(() => {});

    return response;
  } catch (err) {
    console.error(`[FLEET-ADAPTER] Chat to ${agentSlug} FAILED:`, {
      error: err.message,
      model,
      message_preview: userMessage.slice(0, 100),
      timestamp: new Date().toISOString(),
    });
    return makeChatResponse(model, `Error from ${agentSlug}: ${err.message}`);
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => body += chunk);
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function jsonResponse(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:" + PORT);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (url.pathname === "/health" || url.pathname === "/") {
    const models = loadModelConfig();
    return jsonResponse(res, 200, {
      status: "ok", agent: "Fleet Adapter", role: "Model Router",
      agents: Object.keys(AGENTS), model_assignments: models,
      omniroute: OMNIROUTE_URL, port: PORT,
    });
  }

  if (url.pathname === "/api/models" && req.method === "GET") {
    const models = loadModelConfig();
    return jsonResponse(res, 200, { assignments: models, available: AVAILABLE_MODELS });
  }

  if (url.pathname === "/api/models/switch" && req.method === "POST") {
    const body = await parseBody(req);
    const { agent, model } = body;
    if (!agent || !model) return jsonResponse(res, 400, { error: "agent and model required" });
    if (!AGENTS[agent]) return jsonResponse(res, 400, { error: `Unknown agent: ${agent}. Valid: ${Object.keys(AGENTS).join(", ")}` });

    const validModel = AVAILABLE_MODELS.find(m => m.id === model);
    if (!validModel && !model.startsWith("groq/") && !model.startsWith("openrouter/")) {
      return jsonResponse(res, 400, { error: `Unknown model: ${model}. Use /api/models/available` });
    }

    const models = loadModelConfig();
    const prev = models[agent];
    models[agent] = model;
    saveModelConfig(models);

    console.log(`[MODEL SWITCH] ${agent}: ${prev} -> ${model}`);
    return jsonResponse(res, 200, { ok: true, agent, previous_model: prev, new_model: model, assignments: models });
  }

  if (url.pathname === "/api/models/available" && req.method === "GET") {
    return jsonResponse(res, 200, { models: AVAILABLE_MODELS });
  }

  if (url.pathname === "/api/recommend-model" && req.method === "POST") {
    const body = await parseBody(req);
    const { task, agent } = body;
    if (!task) return jsonResponse(res, 400, { error: "task required" });

    const classification = classifyTask(task);
    const agentModel = agent ? loadModelConfig()[agent] : null;

    return jsonResponse(res, 200, {
      recommended: classification.recommended,
      reason: classification.reason,
      confidence: classification.confidence,
      task_type: classification.type,
      agent_current_model: agentModel,
      alternatives: AVAILABLE_MODELS.filter(m => m.id !== classification.recommended && m.id !== "auto").slice(0, 3),
    });
  }

  if (url.pathname === "/api/model-suggestions" && req.method === "GET") {
    const models = loadModelConfig();
    const suggestions = {};
    for (const [agent, currentModel] of Object.entries(models)) {
      suggestions[agent] = {
        current: currentModel,
        suggested: currentModel === "mercury-2" ? "mercury-2" : currentModel,
        reason: currentModel === "mercury-2" ? "Mercury-2 is optimal for general tasks" : "Already assigned a specialized model",
      };
    }
    return jsonResponse(res, 200, { suggestions });
  }

  if (url.pathname === "/api/tokens/log" && req.method === "POST") {
    const body = await parseBody(req);
    const { agent, model, tokens_in, tokens_out, cost, skill_id, task_type } = body;
    if (!agent || !model) return jsonResponse(res, 400, { error: "agent and model required" });

    await logTokenUsage(agent, model, tokens_in || 0, tokens_out || 0, cost || 0, skill_id || null, task_type || null);
    return jsonResponse(res, 200, { ok: true });
  }

  if (url.pathname === "/api/omniroute/health" && req.method === "GET") {
    try {
      const resp = await fetch(`${OMNIROUTE_URL}/v1/models`, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      return jsonResponse(res, 200, { status: "ok", omniroute_url: OMNIROUTE_URL, total_models: data.data ? data.data.length : 0 });
    } catch (err) {
      console.error("[FLEET-ADAPTER] OmniRoute health check FAILED:", err.message);
      return jsonResponse(res, 502, { status: "error", omniroute_url: OMNIROUTE_URL, error: err.message });
    }
  }

  if (url.pathname === "/v1/models" && req.method === "GET") {
    const models = Object.keys(AGENTS).map(slug => ({ id: slug, object: "model", created: Date.now(), owned_by: "pauli-effect" }));
    models.push({ id: "mercury-2", object: "model", created: Date.now(), owned_by: "inception" });
    models.push({ id: "fleet", object: "model", created: Date.now(), owned_by: "hermes" });
    AVAILABLE_MODELS.forEach(m => { models.push({ id: m.id, object: "model", created: Date.now(), owned_by: m.provider }); });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ object: "list", data: models }));
  }

  if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
    const body = await parseBody(req);
    const response = await handleChat(body);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(response));
  }

  if (url.pathname.startsWith("/agent/") && req.method === "POST") {
    const slug = url.pathname.split("/")[2];
    const body = await parseBody(req);
    const message = body.message || body.question || body.mission || body.content || "";
    try {
      const data = await routeToAgent(slug, message);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(data));
    } catch (err) {
      console.error(`[FLEET-ADAPTER] Direct agent call to ${slug} FAILED:`, { error: err.message, timestamp: new Date().toISOString() });
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  console.error(`[FLEET-ADAPTER] 404: ${req.method} ${url.pathname}`);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Fleet adapter on http://localhost:${PORT}`);
  console.log(`Agents: ${Object.keys(AGENTS).join(", ")}`);
  console.log(`Models: ${AVAILABLE_MODELS.length} available (${AVAILABLE_MODELS.filter(m => m.cost === "free").length} free)`);
  console.log(`Model switching: GET /api/models, POST /api/models/switch`);
  console.log(`Recommendations: POST /api/recommend-model`);
  console.log(`Token logging: POST /api/tokens/log`);
  console.log(`OmniRoute: ${OMNIROUTE_URL}`);
  console.log(`Skills API: ${SKILLS_API}`);
});
