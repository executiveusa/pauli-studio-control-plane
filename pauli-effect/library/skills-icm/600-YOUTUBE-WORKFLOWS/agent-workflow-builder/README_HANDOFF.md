# Agent Workflow Builder — Complete Handoff Package

**What you have**: A complete skill that converts YouTube channels into executable A2A agent workflows, deployable to your VPS and usable by all 4 agents (Claude Code, Goose, Cursor, Windsurf).

**What you're handing off**: One script + credential setup + agent configs = all agents can start scraping and building workflows.

---

## 📦 Package Contents

```
DEPLOY_TO_VPS.sh                  ← Run this ONCE on your VPS to install everything
AGENT_DEPLOYMENT_MANIFEST.md      ← Complete setup instructions for all agents
mcp_server.py                     ← MCP protocol server (agents call this)
agent-workflow-builder.cli.sh     ← CLI wrapper (agents can also call this directly)
requirements.txt                  ← Python dependencies
michtortiyt-agent-workflows.zip   ← 4 complete A2A workflows (sales/lead_gen/ops/research)
README_HANDOFF.md                 ← This file
```

---

## 🚀 Quick Start (5 minutes)

### Step 1: SSH into your VPS and run the deploy script

```bash
# From your local machine
scp DEPLOY_TO_VPS.sh user@your-vps-ip:~/

# SSH in
ssh user@your-vps-ip

# Deploy
bash DEPLOY_TO_VPS.sh
```

The script will:
- ✅ Install Python dependencies
- ✅ Install yt-dlp and Bright Data CLI
- ✅ Create credential files (`~/.brightdata.env`)
- ✅ Create CLI wrapper (`/opt/agent-skills/agent-workflow-builder/bin/agent-workflow-builder`)
- ✅ Output next steps

### Step 2: Configure credentials

```bash
# Edit the credential file
nano ~/.brightdata.env
```

Replace these with your actual values:
```bash
export BRIGHTDATA_API_KEY="your_actual_api_key"  # Get from brightdata.com/cp
export SUPABASE_URL="your_supabase_url"           # Get from supabase.com/dashboard
export SUPABASE_SERVICE_KEY="your_service_key"    # Get from Supabase project settings
```

### Step 3: Test the installation

```bash
source ~/.brightdata.env
agent-workflow-builder health-check
```

You should see:
```
✅ System status: HEALTHY

✅ Bright Data CLI: OK
✅ Bright Data Key: OK
✅ Supabase Connection: OK
✅ Skill Location: OK
✅ Python Dependencies: OK
```

### Step 4: Scrape your first channel

```bash
agent-workflow-builder scrape \
  --channel "https://www.youtube.com/@michtortiyt" \
  --max-videos 20 \
  --output-dir ~/agent-workflows
```

Output:
```
→ Scraping https://www.youtube.com/@michtortiyt

✅ Scraped 20 videos from @michtortiyt
   Videos processed: 20
   Clusters generated: 6
   Workflows created: 4
   Output directory: ~/agent-workflows
   Time: 4m 32s
```

---

## 🤖 How Agents Use This

### Claude Code (Desktop App)

1. Add to `~/.config/claude/claude.json`:
```json
{
  "mcpServers": {
    "agent-workflow-builder": {
      "command": "python3",
      "args": ["/opt/agent-skills/agent-workflow-builder/mcp_server.py"],
      "env": {
        "BRIGHTDATA_API_KEY": "from ~/.brightdata.env",
        "SUPABASE_URL": "from ~/.brightdata.env",
        "SUPABASE_SERVICE_KEY": "from ~/.brightdata.env"
      }
    }
  }
}
```

2. In Claude Code chat:
```
I need to scrape @michtortiyt's last 20 videos 
and convert them into A2A workflows for my AI agency repo.
```

Claude Code will discover the `agent-workflow-builder` MCP tool and execute it.

### Goose Coder

Add to `~/.config/goose/config.yaml`:
```yaml
extensions:
  agent-workflow-builder:
    type: stdio
    cmd: python3
    args:
      - /opt/agent-skills/agent-workflow-builder/mcp_server.py
    env:
      BRIGHTDATA_API_KEY: "${BRIGHTDATA_API_KEY}"
      SUPABASE_URL: "${SUPABASE_URL}"
      SUPABASE_SERVICE_KEY: "${SUPABASE_SERVICE_KEY}"
```

Then in Goose session:
```
Create agent workflows from the Michele Torti channel
```

### Cursor / Windsurf

Add to `.cursor/config.json` (or `windsurf.config.json`):
```json
{
  "mcp_servers": {
    "agent_workflow_builder": {
      "command": "python3",
      "args": ["/opt/agent-skills/agent-workflow-builder/mcp_server.py"],
      "env": {
        "BRIGHTDATA_API_KEY": "${env:BRIGHTDATA_API_KEY}",
        "SUPABASE_URL": "${env:SUPABASE_URL}",
        "SUPABASE_SERVICE_KEY": "${env:SUPABASE_SERVICE_KEY}"
      }
    }
  }
}
```

Then in IDE chat:
```
@agent-workflow-builder scrape @michtortiyt/videos \
  --max-videos 20 \
  --auto-deploy
```

### CLI / Bash Agents

Any agent running on the command line can call:

```bash
source ~/.brightdata.env
agent-workflow-builder scrape --channel "https://..." --output-dir ~/agent-workflows
```

---

## 📋 Available Commands

```bash
# Scrape a YouTube channel
agent-workflow-builder scrape \
  --channel "URL" \
  --max-videos 20 \
  --output-dir ./agent-workflows \
  --repo-root . \
  --auto-commit

# Analyze repository for missing infrastructure
agent-workflow-builder analyze-gaps --repo-root ~/my-repo

# List all generated workflows
agent-workflow-builder list-workflows --dir ./agent-workflows

# Get specific workflow details
agent-workflow-builder get-workflow wf_sales_ai_agency_close_system_20260719

# Health check installation
agent-workflow-builder health-check

# Show help
agent-workflow-builder help
```

---

## 🔍 What Gets Generated

After running `agent-workflow-builder scrape`, you'll have:

```
agent-workflows/
├── README.md                                                   ← Index
├── sales/
│   ├── wf_sales_ai_agency_close_system_20260719.json         ← A2A spec
│   └── wf_sales_ai_agency_close_system_20260719.prompt.md    ← Human-readable
├── lead_gen/
│   ├── wf_lead_gen_ai_agency_30day_client_20260719.json
│   └── wf_lead_gen_ai_agency_30day_client_20260719.prompt.md
├── ops/
│   ├── wf_ops_ai_agency_one_offer_system_20260719.json
│   └── wf_ops_ai_agency_one_offer_system_20260719.prompt.md
├── research/
│   ├── wf_research_ai_agency_niche_selection_20260719.json
│   └── wf_research_ai_agency_niche_selection_20260719.prompt.md
└── logs/
    └── metrics_20260719.json                                  ← Execution metrics

AGENTS.md                                                       ← Agent bootstrap guide
```

Each workflow contains:
- **A2A JSON spec** (strict Google A2A format)
- **5 agents** (orchestrator, executor, guardian, reporter, + 1 domain-specific)
- **4+ tasks** with step-by-step instructions
- **4+4 guardrails** with violation scoring
- **Supabase monitoring** hooks
- **GitHub Actions** cron setup

---

## 🎯 What Each Agent Should Do

### Day 1: Bootstrap
- [ ] Claude Code: Run health-check, confirm all systems go
- [ ] Goose Coder: Run scrape command, generate first workflows
- [ ] Cursor: Analyze workflows, identify gaps in repo
- [ ] Windsurf: Deploy workflows to repo, set up GitHub Actions

### Day 2-7: Execute
- [ ] All agents: Use the generated workflows as tasks
- [ ] Agents read: `AGENTS.md` in repo to understand workflow patterns
- [ ] Agents log: Execution metrics to Supabase automatically

### Week 2+: Iterate
- [ ] Weekly cron (Monday 3am UTC): Scrape new videos from @michtortiyt
- [ ] Agents auto-update workflows from channel
- [ ] Learning loop: Each migration improves pattern detection
- [ ] Metrics flow to Supabase dashboard for monitoring

---

## 🔧 Troubleshooting

### "agent-workflow-builder: command not found"

```bash
# Ensure skill is in PATH
export PATH="/opt/agent-skills/agent-workflow-builder/bin:$PATH"

# Make permanent
echo 'export PATH="/opt/agent-skills/agent-workflow-builder/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### "BRIGHTDATA_API_KEY not set"

```bash
# Verify credentials file exists
cat ~/.brightdata.env

# Reload environment
source ~/.brightdata.env

# Test
echo $BRIGHTDATA_API_KEY
```

### "yt-dlp rate limited → falling back to Bright Data"

This is normal and expected. The skill handles it automatically:
1. Tries yt-dlp (free, fast)
2. Falls back to Bright Data MCP (premium, handles blocks)
3. Falls back to content synthesis from public channel data

### "Supabase connection failed"

```bash
# Check credentials
echo "URL: $SUPABASE_URL"
echo "Key: ${SUPABASE_SERVICE_KEY:0:20}..."

# Test connection manually
python3 << 'EOF'
from supabase import create_client
import os
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
sb = create_client(url, key)
result = sb.table("workflow_metrics").select("*").limit(1).execute()
print("✅ Connected")
EOF
```

---

## 📊 Monitoring

After workflows are generated and agents start executing, monitor progress:

```bash
# View Supabase metrics dashboard
# https://supabase.com/dashboard -> Workflows project -> workflow_metrics table

# Check execution logs on VPS
tail -f /var/log/agent-workflows.log

# View workflow health
agent-workflow-builder health-check
agent-workflow-builder list-workflows
```

---

## 🔐 Security

**Credentials are kept private:**
- `~/.brightdata.env` is local only (never in git)
- Supabase service key is only in the file (not in code)
- GitHub Actions uses secrets (never hardcoded)

**Secrets management (optional):**
```bash
# Use Infisical instead of .env file
brew install infisical
infisical run -- agent-workflow-builder scrape ...
```

---

## 📚 Full Documentation

For detailed setup per agent, see: **AGENT_DEPLOYMENT_MANIFEST.md**

This file contains:
- Step-by-step VPS setup (Step 1)
- Per-agent MCP registration (Step 2)
- CLI entry point (Step 3)
- Health check & monitoring (Steps 5-6)
- Automation setup (Step 7)
- Troubleshooting guide (Step 8)

---

## ✅ Success Criteria

You know the handoff is complete when:

- ✅ `agent-workflow-builder health-check` returns all green
- ✅ At least one agent (Claude Code, Goose, etc.) can call the tool via MCP
- ✅ `agent-workflow-builder scrape` runs without errors
- ✅ Workflows appear in `~/agent-workflows/`
- ✅ Metrics appear in Supabase `workflow_metrics` table
- ✅ All 4 agents can discover the skill autonomously

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Deploy to VPS | `bash DEPLOY_TO_VPS.sh` |
| Check health | `agent-workflow-builder health-check` |
| Scrape videos | `agent-workflow-builder scrape --channel URL` |
| List workflows | `agent-workflow-builder list-workflows` |
| Analyze gaps | `agent-workflow-builder analyze-gaps --repo-root .` |
| View help | `agent-workflow-builder help` |
| Edit credentials | `nano ~/.brightdata.env` |
| View logs | `tail -f /var/log/agent-workflows.log` |

---

## 🎓 What This Enables

After deployment, your agents can:

✅ Autonomously convert YouTube content into structured A2A workflows  
✅ Detect gaps in your AI agency infrastructure  
✅ Generate executable task definitions for other agents  
✅ Learn from each execution (pattern database grows)  
✅ Self-improve through feedback loops  
✅ Monitor their own health via Supabase dashboard  
✅ Coordinate across multiple runtime environments  

All 4 agents working together, pulling from the same workflows, learning from the same metrics.

---

**Ready? SSH into your VPS and run:**

```bash
bash DEPLOY_TO_VPS.sh
```

Then edit `~/.brightdata.env` and test with:

```bash
agent-workflow-builder health-check
agent-workflow-builder scrape --channel https://www.youtube.com/@michtortiyt --max-videos 5
```

Good luck! 🚀

---

*Generated by agent-workflow-builder from 20 @michtortiyt videos | Ready for production deployment*
