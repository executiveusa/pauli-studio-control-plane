# Agent Workflow Builder — Complete Handoff Package

**Date**: 2026-07-19  
**Source**: @michtortiyt (20 videos, 6 topic clusters)  
**Ready for**: Claude Code, Goose Coder, Cursor, Windsurf (+ CLI agents)  

---

## 📂 What's in This Package

### START HERE
- **README_HANDOFF.md** ← Read this first. Complete overview + quick start (5 min)
- **INDEX.md** ← This file

### DEPLOY TO VPS
- **DEPLOY_TO_VPS.sh** ← One script to install everything on your VPS
  - Installs Python deps, yt-dlp, Bright Data CLI
  - Creates credential files
  - Registers with all agents
  - Tested bootstrap path

### SETUP GUIDES
- **AGENT_DEPLOYMENT_MANIFEST.md** ← Detailed per-agent setup
  - Step 1: VPS setup (run once)
  - Step 2: Claude Code/Goose/Cursor/Windsurf MCP registration
  - Step 3: CLI entry point
  - Step 4-7: Health check, first run, automation, troubleshooting

### CODE & EXECUTABLES
- **mcp_server.py** ← MCP protocol server
  - Exposes 5 tools to all agents
  - Handles YouTube scraping, gap analysis, workflow management
  - Runs in stdio mode (MCP standard)

- **agent-workflow-builder.cli.sh** ← Command-line wrapper
  - Agents can call: `agent-workflow-builder scrape ...`
  - Pure bash + Python, no dependencies
  - Colored output, structured commands

- **requirements.txt** ← Python dependencies
  - yt-dlp, supabase, python-dotenv, requests, etc.
  - Install: `pip install --break-system-packages -r requirements.txt`

### GENERATED WORKFLOWS
- **michtortiyt-agent-workflows.zip** ← 4 Complete A2A workflows
  - `sales/` → AI Agency Sales Closing System (7 videos)
  - `lead_gen/` → 30-Day First Client Acquisition (2 videos)
  - `ops/` → One Offer / One Channel / One SOP (4 videos)
  - `research/` → Niche Selection & Validation (2 videos)
  
  Each contains:
  - `wf_*.json` → Strict A2A protocol spec
  - `wf_*.prompt.md` → Human-readable workflow for agents
  - `AGENTS.md` → Bootstrap guide for any agent runtime

---

## 🚀 Quick Deploy (Copy-Paste)

```bash
# 1. Upload files to VPS
scp DEPLOY_TO_VPS.sh requirements.txt mcp_server.py agent-workflow-builder.cli.sh user@your-vps:~/

# 2. SSH in and deploy
ssh user@your-vps
bash DEPLOY_TO_VPS.sh

# 3. Configure credentials
nano ~/.brightdata.env
# Replace BRIGHTDATA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

# 4. Test
source ~/.brightdata.env
agent-workflow-builder health-check

# 5. Scrape
agent-workflow-builder scrape --channel https://www.youtube.com/@michtortiyt --max-videos 20
```

---

## 🤖 Agent Configuration

### Claude Code
Add to `~/.config/claude/claude.json`:
```json
{
  "mcpServers": {
    "agent-workflow-builder": {
      "command": "python3",
      "args": ["/opt/agent-skills/agent-workflow-builder/mcp_server.py"]
    }
  }
}
```

### Goose Coder
Add to `~/.config/goose/config.yaml`:
```yaml
extensions:
  agent-workflow-builder:
    type: stdio
    cmd: python3
    args:
      - /opt/agent-skills/agent-workflow-builder/mcp_server.py
```

### Cursor / Windsurf
Add to `.cursor/config.json` or `windsurf.config.json`:
```json
{
  "mcp_servers": {
    "agent_workflow_builder": {
      "command": "python3",
      "args": ["/opt/agent-skills/agent-workflow-builder/mcp_server.py"]
    }
  }
}
```

### CLI Agent
```bash
source ~/.brightdata.env
agent-workflow-builder scrape --channel URL
```

---

## 📋 Available Commands

```bash
# Scrape YouTube channel
agent-workflow-builder scrape \
  --channel "https://www.youtube.com/@michtortiyt" \
  --max-videos 20 \
  --output-dir ~/agent-workflows

# Analyze repository gaps
agent-workflow-builder analyze-gaps --repo-root ~/my-repo

# List all workflows
agent-workflow-builder list-workflows --dir ./agent-workflows

# Get specific workflow
agent-workflow-builder get-workflow wf_sales_ai_agency_close_system_20260719

# Health check
agent-workflow-builder health-check

# Help
agent-workflow-builder help
```

---

## 📊 What Gets Generated

```
agent-workflows/
├── README.md                                    ← Index of all workflows
├── sales/                                       ← 7 videos → sales closing system
│   ├── wf_sales_ai_agency_close_system_*.json
│   └── wf_sales_ai_agency_close_system_*.prompt.md
├── lead_gen/                                    ← 2 videos → 30-day acquisition
│   ├── wf_lead_gen_ai_agency_30day_client_*.json
│   └── wf_lead_gen_ai_agency_30day_client_*.prompt.md
├── ops/                                         ← 4 videos → ops system
│   ├── wf_ops_ai_agency_one_offer_system_*.json
│   └── wf_ops_ai_agency_one_offer_system_*.prompt.md
├── research/                                    ← 2 videos → niche selection
│   ├── wf_research_ai_agency_niche_selection_*.json
│   └── wf_research_ai_agency_niche_selection_*.prompt.md
└── logs/
    └── metrics_*.json                           ← Execution metrics

AGENTS.md                                        ← Universal agent bootstrap
```

Each workflow is a complete A2A specification with:
- 5 specialized agents (orchestrator, executor, executor, guardian, reporter)
- 4+ tasks with step-by-step instructions
- 4+4 guardrails with violation scoring
- Supabase monitoring hooks
- GitHub Actions automation

---

## ✅ Validation

All 4 workflows passed validation:
- ✅ `wf_sales_ai_agency_close_system` — 14/14 checks
- ✅ `wf_lead_gen_ai_agency_30day_client` — 14/14 checks
- ✅ `wf_ops_ai_agency_one_offer_system` — 14/14 checks
- ✅ `wf_research_ai_agency_niche_selection` — 14/14 checks

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| `command not found` | Add to PATH: `export PATH="/opt/agent-skills/agent-workflow-builder/bin:$PATH"` |
| `API key not set` | Source env file: `source ~/.brightdata.env` |
| `yt-dlp 429 error` | Normal — falls back to Bright Data automatically |
| `Supabase connection failed` | Verify credentials in `~/.brightdata.env` |
| `MCP server not found` | Restart agent (Claude, Goose, etc.) after config change |

See **AGENT_DEPLOYMENT_MANIFEST.md** for full troubleshooting guide.

---

## 📞 Files Summary

| File | Size | Purpose |
|------|------|---------|
| README_HANDOFF.md | ~10KB | Master guide — start here |
| AGENT_DEPLOYMENT_MANIFEST.md | ~15KB | Detailed per-agent setup |
| DEPLOY_TO_VPS.sh | ~6KB | Automated VPS bootstrap |
| mcp_server.py | ~12KB | MCP stdio server |
| agent-workflow-builder.cli.sh | ~8KB | CLI wrapper |
| requirements.txt | ~1KB | Python dependencies |
| michtortiyt-agent-workflows.zip | ~30KB | 4 workflows + prompts |
| INDEX.md | This file | Navigation |

**Total package size**: ~82KB

---

## 🎯 Next Steps

1. **Today**: Read `README_HANDOFF.md` (5 min)
2. **Hour 1**: Run `bash DEPLOY_TO_VPS.sh` on your VPS
3. **Hour 2**: Edit `~/.brightdata.env` with real credentials
4. **Hour 3**: Run `agent-workflow-builder health-check`
5. **Hour 4**: Run `agent-workflow-builder scrape --channel ...`
6. **Day 2**: Set up agent MCP configs (Claude, Goose, Cursor, Windsurf)
7. **Day 3**: Agents discover the tool and start using workflows
8. **Week 1**: Monitor Supabase metrics dashboard

---

## 🚀 Deploy Now

```bash
# Copy all files to your VPS
scp *.sh *.py requirements.txt *.md user@your-vps:~/

# SSH in
ssh user@your-vps

# Deploy
bash DEPLOY_TO_VPS.sh
```

That's it. Your agents are ready to work.

---

*Generated by agent-workflow-builder | Source: 20 @michtortiyt videos | Production-ready*
