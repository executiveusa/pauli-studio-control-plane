const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const { spawn } = require("node:child_process");

async function availablePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const result = await fetch(url);
      if (result.ok) return;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  throw new Error("Cosmos test service never started");
}
test("Cosmos reads full contract and optional Heart/Soul; rejects unauthenticated requests", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cosmos-test-"));
  const company = path.join(root, "company");
  const agent = path.join(root, "agents", "cosmos-pi");
  const guard = path.join(root, "guardrails");
  fs.mkdirSync(company, { recursive: true });
  fs.mkdirSync(agent, { recursive: true });
  fs.mkdirSync(guard, { recursive: true });
  const sentinel = "END_OF_CONTRACT_SENTINEL";
  fs.writeFileSync(path.join(root, "AGENTS.md"), "ICM_GLOBAL_IDENTITY");
  fs.writeFileSync(path.join(root, "CONTEXT.md"), "MISSION_ROUTER");
  fs.writeFileSync(path.join(company, "HEART.md"), "HEART_OF_THE_COMPANY");
  fs.writeFileSync(path.join(company, "SOUL.md"), "SOUL_OF_THE_COMPANY");
  fs.writeFileSync(path.join(guard, "HARD_BLOCKS.md"), "HUMAN_APPROVAL_REQUIRED");
  fs.writeFileSync(path.join(agent, "CONTEXT.md"), "COSMOS_IDENTITY\n" + "A".repeat(4400) + sentinel);
  const model = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    const system = parsed.messages[0].content;
    assert.match(system, /COSMOS_IDENTITY/);
    assert.match(system, /END_OF_CONTRACT_SENTINEL/);
    assert.match(system, /HEART_OF_THE_COMPANY/);
    assert.match(system, /SOUL_OF_THE_COMPANY/);
    assert.match(system, /HUMAN_APPROVAL_REQUIRED/);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "verified-response" } }] }));
  });
  await new Promise(resolve => model.listen(0, "127.0.0.1", resolve));
  const port = await availablePort();
  const child = spawn(process.execPath, [path.join(__dirname, "../agents/cosmos-pi/server.js")], {
    env: { ...process.env, AGENT_HOST: "127.0.0.1", AGENT_PORT: String(port),
      AGENT_ACCESS_TOKEN: "synthetic-test-token", OPENAI_API_KEY: "synthetic",
      API_BASE: "http://127.0.0.1:" + model.address().port, PAULI_ROOT: root,
      PI_COMPANY_ROOT: company, MODEL: "test-model" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const base = "http://127.0.0.1:" + port;
    await waitFor(base + "/health");
    const noToken = await fetch(base + "/chat", { method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "test" }) });
    assert.equal(noToken.status, 401);
    const yesToken = await fetch(base + "/chat", { method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer synthetic-test-token" },
      body: JSON.stringify({ message: "test" }) });
    assert.equal(yesToken.status, 200);
    assert.equal((await yesToken.json()).response, "verified-response");
    const mission = await fetch(base + "/mission", { method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer synthetic-test-token" },
      body: JSON.stringify({ mission: "Plan a synthetic change" }) });
    assert.equal(mission.status, 200);
    const missionBody = await mission.json();
    assert.equal(missionBody.executed, false);
    assert.equal(missionBody.phase, "planning_only");
  } finally {
    child.kill();
    await new Promise(resolve => child.once("exit", resolve));
    await new Promise(resolve => model.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("skills API has no embedded password and requires auth on mutating endpoints", () => {
  const content = fs.readFileSync(path.join(__dirname, "../agents/skills-api/server.js"), "utf8");
  assert.match(content, /process.env.SKILLS_ACCESS_PASSWORD/);
  for (const endpoint of [
    'url.pathname.endsWith("/execute")',
    'url.pathname === "/personas/active" && req.method === "POST"',
    'url.pathname === "/tokens/log" && req.method === "POST"'
  ]) {
    const start = content.indexOf(endpoint);
    assert.notEqual(start, -1, endpoint);
    assert.match(content.slice(start, start + 350), /checkAuth\(req\)/);
  }
});
