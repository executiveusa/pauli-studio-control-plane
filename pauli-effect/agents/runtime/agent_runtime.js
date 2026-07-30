/**
 * Pauli Effect Agent Runtime — Cross-Platform (Windows/Mac/Linux/VPS)
 * -------------------------------------------------------------------
 * Every agent (TARS, Cosmos-II, Cosmos-Pi) runs this lightweight HTTP server.
 * It gives each agent:
 *   - A /health endpoint (Mission Control pings this)
 *   - A /mission endpoint (Hermes POSTs missions here)
 *   - A /status endpoint (current activity)
 *   - A web UI at / (demo-able in any browser)
 *
 * The agent's "brain" is an LLM call (OpenAI-compatible API).
 * Missions are JSON: { mission, context, priority }
 *
 * Usage: node agent_runtime.js --name TARS --role "Builder" --port 4321
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Config from CLI args + env ──────────────────────────────────
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : null;
}

const AGENT_NAME = arg('name') || process.env.AGENT_NAME || 'Agent';
const AGENT_ROLE = arg('role') || process.env.AGENT_ROLE || 'Assistant';
const PORT = parseInt(arg('port') || process.env.AGENT_PORT || '4800');
const API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const API_BASE = process.env.API_BASE || 'https://api.openai.com/v1';
const MODEL = process.env.MODEL || 'gpt-4o-mini';
const PAULI_ROOT = process.env.PAULI_ROOT || '/opt/pauli-effect';
const PERSONALITY = arg('personality') || process.env.AGENT_PERSONALITY || 'helpful, direct, professional';

const startTime = Date.now();
let currentMission = null;
let missionHistory = [];
let logs = [];

function log(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  logs.push(entry);
  if (logs.length > 100) logs.shift();
  console.log(entry);
}

// ── Agent brain: call LLM ───────────────────────────────────────
async function think(userMessage, systemContext) {
  if (!API_KEY) {
    return `[${AGENT_NAME} demo mode — no API key configured]\n\nI received your message: "${userMessage}"\n\nTo make me fully functional, set OPENAI_API_KEY or ANTHROPIC_API_KEY in the environment. In demo mode I can show my interface, receive missions, and log activity, but I can't actually reason without a model.`;
  }

  try {
    const resp = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemContext },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '[No response from model]';
  } catch (err) {
    return `[Error contacting model: ${err.message}]`;
  }
}

function systemContext() {
  return `You are ${AGENT_NAME}, the ${AGENT_ROLE} of The Pauli Effect.
You are operated by Bambú (Jeremy Bowers), the director.
Personality: ${PERSONALITY}
Rules: No emojis in code. Technical prose. Direct and honest. Anti-slop.
When you receive a mission, acknowledge it, then describe your plan in 2-3 sentences.
Keep responses concise. You are part of a 4-agent team (Hermes orchestrates, Cosmos-Pi is engineering lead, TARS builds apps, Cosmos-II manages the knowledge graph).`;
}

// ── HTTP Server ─────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS + JSON helpers
  function json(code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data, null, 2));
  }
  function html(content) {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    res.end(content);
  }

  // ── Health check (Mission Control pings this) ──
  if (url.pathname === '/health') {
    json(200, {
      status: 'ok',
      agent: AGENT_NAME,
      role: AGENT_ROLE,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      current_mission: currentMission ? currentMission.mission : null,
      model: API_KEY ? MODEL : 'demo-mode'
    });
    return;
  }

  // ── Status ──
  if (url.pathname === '/status') {
    json(200, {
      agent: AGENT_NAME,
      role: AGENT_ROLE,
      online: true,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      missions_completed: missionHistory.length,
      current_mission: currentMission,
      recent_logs: logs.slice(-5)
    });
    return;
  }

  // ── Receive a mission (Hermes POSTs here) ──
  if (url.pathname === '/mission' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const mission = JSON.parse(body);
        currentMission = mission;
        log(`Mission received: ${mission.mission}`);

        // Think about the mission
        const response = await think(
          `Mission: ${mission.mission}\nContext: ${mission.context || 'none'}\nPriority: ${mission.priority || 'normal'}`,
          systemContext()
        );

        mission.result = response;
        mission.completed_at = new Date().toISOString();
        missionHistory.push(mission);
        currentMission = null;
        log(`Mission completed: ${mission.mission.slice(0, 50)}...`);

        json(200, { accepted: true, response });
      } catch (err) {
        log(`Mission error: ${err.message}`);
        json(400, { error: err.message });
      }
    });
    return;
  }

  // ── Chat (for the web UI + demos) ──
  if (url.pathname === '/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { message } = JSON.parse(body);
        log(`Chat: ${message.slice(0, 80)}`);
        const response = await think(message, systemContext());
        json(200, { response });
      } catch (err) {
        json(400, { error: err.message });
      }
    });
    return;
  }

  // ── Logs ──
  if (url.pathname === '/logs') {
    json(200, logs);
    return;
  }

  // ── Web UI (demo interface) ──
  if (url.pathname === '/' || url.pathname === '/index.html') {
    html(agentUI());
    return;
  }

  json(404, { error: 'Not found', endpoints: ['/health', '/status', '/mission', '/chat', '/logs'] });
});

function agentUI() {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${AGENT_NAME} — ${AGENT_ROLE}</title>
<style>
:root{--bg:#fff;--surface:#f7f7f8;--ink:#0a0a0a;--muted:#6e6e73;--border:rgba(0,0,0,.1);--gold:#F5A617;--green:#16a34a}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;flex-direction:column}
header{padding:20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px}
.icon{width:44px;height:44px;border-radius:12px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.2rem}
h1{font-size:1.1rem;font-weight:700}
.role{font-size:.8rem;color:var(--muted)}
.status{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:.75rem;color:var(--green)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
main{flex:1;max-width:680px;width:100%;margin:0 auto;padding:20px;display:flex;flex-direction:column}
.chat{flex:1;overflow-y:auto;margin-bottom:16px}
.msg{padding:14px 16px;border-radius:12px;margin-bottom:10px;max-width:85%;line-height:1.5;font-size:.9rem}
.msg.user{background:var(--ink);color:#fff;margin-left:auto}
.msg.agent{background:var(--surface);border:1px solid var(--border)}
.msg.system{background:rgba(245,166,23,.1);border:1px solid rgba(245,166,23,.3);font-size:.8rem;color:var(--muted)}
.input-area{display:flex;gap:8px}
input{flex:1;padding:12px 16px;border:1px solid var(--border);border-radius:24px;font-size:.9rem;font-family:inherit;outline:none}
input:focus{border-color:var(--ink)}
button{background:var(--ink);color:#fff;border:none;border-radius:24px;padding:12px 20px;cursor:pointer;font-size:.9rem;white-space:nowrap}
button:hover{opacity:.85}
button:disabled{opacity:.4;cursor:default}
.info{font-size:.7rem;color:var(--muted);text-align:center;margin-top:8px}
</style></head><body>
<header>
<div class="icon">${AGENT_NAME.charAt(0)}</div>
<div><h1>${AGENT_NAME}</h1><div class="role">${AGENT_ROLE} · The Pauli Effect</div></div>
<div class="status"><span class="dot"></span> Online</div>
</header>
<main>
<div class="chat" id="chat">
<div class="msg system">Connected to ${AGENT_NAME}. ${API_KEY ? 'Model: ' + MODEL : 'Demo mode — set an API key for full functionality.'}</div>
<div class="msg agent">Hello. I'm ${AGENT_NAME}, your ${AGENT_ROLE.toLowerCase()}. I'm online and ready. What do you need?</div>
</div>
<div class="input-area">
<input id="input" placeholder="Message ${AGENT_NAME}..." onkeydown="if(event.key==='Enter')send()"/>
<button id="send" onclick="send()">Send</button>
</div>
<div class="info">${AGENT_NAME} runs 24/7 on The Pauli Effect VPS · Port ${PORT}</div>
</main>
<script>
var chat=document.getElementById('chat'),input=document.getElementById('input'),btn=document.getElementById('send');
function add(text,cls){var d=document.createElement('div');d.className='msg '+cls;d.textContent=text;chat.appendChild(d);chat.scrollTop=chat.scrollHeight;}
async function send(){
var msg=input.value.trim();if(!msg)return;
input.value='';btn.disabled=true;btn.textContent='...';
add(msg,'user');
try{
var r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
var d=await r.json();
add(d.response||d.error,'agent');
}catch(e){add('Connection error: '+e.message,'system');}
btn.disabled=false;btn.textContent='Send';input.focus();
}
</script>
</body></html>`;
}

server.listen(PORT, '0.0.0.0', () => {
  log(`${AGENT_NAME} (${AGENT_ROLE}) running on port ${PORT}`);
  log(`Model: ${API_KEY ? MODEL : 'demo-mode (no API key)'}`);
  log(`Web UI: http://localhost:${PORT}`);
});
