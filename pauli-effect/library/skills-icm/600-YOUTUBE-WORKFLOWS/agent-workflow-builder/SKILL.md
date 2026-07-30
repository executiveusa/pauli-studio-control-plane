---
name: agent-workflow-builder
description: |
  Convert YouTube channels into executable A2A (Agent-to-Agent) workflows.
  Scrapes video content using yt-dlp with BrightData fallback, analyzes topic clusters,
  and generates structured workflow specs with 5-agent teams, guardrails, and monitoring.
  
  Triggers: "scrape youtube", "build workflow from youtube", "convert videos to workflows",
  "youtube to a2a", "agent workflow", "analyze youtube channel"
  
triggers:
  - "scrape youtube"
  - "build workflow from youtube"
  - "convert videos to workflows"
  - "youtube to a2a"
  - "agent workflow"
  - "analyze youtube channel"
  - "workflow from channel"
  - "youtube scraping"

tags:
  - youtube
  - scraping
  - workflows
  - a2a
  - brightdata
  - mcp

---

# Agent Workflow Builder — YouTube to A2A Workflows

## What This Skill Does

Converts YouTube channels into executable A2A agent workflows:
1. Scrapes YouTube channel (yt-dlp, BrightData fallback)
2. Analyzes videos into topic clusters
3. Generates A2A workflow specs (JSON + human-readable .prompt.md)
4. Each workflow: 5 agents, 4+ tasks, guardrails, Supabase monitoring

## How to Use

### CLI Commands
```bash
# Scrape a YouTube channel
agent-workflow-builder scrape \
  --channel "https://www.youtube.com/@channel" \
  --max-videos 20 \
  --output-dir ~/agent-workflows

# List all workflows
agent-workflow-builder list-workflows --dir ~/agent-workflows

# Get specific workflow
agent-workflow-builder get-workflow wf_sales_ai_agency_close_system_20260719

# Health check
agent-workflow-builder health-check

# Analyze repo gaps
agent-workflow-builder analyze-gaps --repo-root ~/my-repo
```

### MCP Server
The MCP server exposes 5 tools:
- `scrape_channel` — Scrape YouTube and generate workflows
- `analyze_repo_gaps` — Find missing infrastructure
- `list_workflows` — List available workflows
- `get_workflow` — Fetch specific workflow spec
- `health_check` — Verify installation

## File Locations
- Skill files: `/opt/pauli-effect/library/skills-icm/600-YOUTUBE-WORKFLOWS/agent-workflow-builder/`
- CLI: `/opt/agent-skills/agent-workflow-builder/bin/agent-workflow-builder`
- MCP Server: `/opt/agent-skills/agent-workflow-builder/mcp_server.py`
- Credentials: `~/.brightdata.env`

## Generated Workflows
Output structure:
```
agent-workflows/
├── sales/          ← Sales closing workflows
├── lead_gen/       ← Client acquisition workflows
├── ops/            ← Operations & delivery workflows
├── research/       ← Niche selection & validation workflows
└── logs/           ← Execution metrics
```

Each workflow contains:
- A2A JSON spec (Google A2A format)
- 5 agents (orchestrator, executor, guardian, reporter, + domain)
- 4+ tasks with step-by-step instructions
- 4+4 guardrails with violation scoring
- Supabase monitoring hooks

## Prerequisites
- Python 3.10+
- yt-dlp (`pip install yt-dlp`)
- BrightData API key (for YouTube scraping fallback)
- Supabase (optional, for workflow metrics)

## Access
All agents (jarvis, tars, pi, hermes, cosmos-pi, dashboard)
