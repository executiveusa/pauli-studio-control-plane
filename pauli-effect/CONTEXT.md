# CONTEXT.md — Mission Router

> This file tells the active agent which stage to open.
> The folder tree IS the orchestration framework (ICM).

## How routing works

When a mission arrives (via Telegram, dashboard, or direct command):

1. **Hermes reads this file** → decides which agent handles it
2. **Hermes writes a mission file** → `missions/<mission-id>.md`
3. **The assigned agent reads its CONTEXT.md** → executes the stage contract
4. **Agent writes output** → `runs/<run-id>/`
5. **Hermes reports to Bambú** → Telegram + dashboard

## Agent routing table

| Mission type | Route to | Why |
|-------------|----------|-----|
| Code question, architecture, engineering decision | **Cosmos (Pi)** | Engineering lead, reads the brain |
| Build an app, landing page, website | **TARS** | Voice mission builder, Claude Code |
| Update second brain, organize knowledge, graph query | **Cosmos-II** | Brain keeper, Amentis Library |
| Dispatch, coordinate, report to Bambú | **Hermes** | Orchestrator, stays self |
| Deploy, VPS ops, Supabase changes | **Cosmos (Pi)** + human approval | Engineering + gate |
| Design, cinematic landing, Awwwards UI, Remotion video, brand polish | **Hermes (Design Studio mode)** | Karpathy Council — see agents/hermes/DESIGN_STUDIO_WORKFLOW.md |
| Client onboarding, project creation | **Cosmos-II** | Creates nodes in the graph |

## Current active missions

(Check `missions/` folder for active mission files)

## Stage contracts

Each agent has its own CONTEXT.md defining inputs, process, outputs, and gates:

- `agents/hermes/CONTEXT.md` — orchestrator contract
- `agents/cosmos-pi/CONTEXT.md` — engineering lead contract
- `agents/tars/CONTEXT.md` — builder contract
- `agents/cosmos-brain/CONTEXT.md` — brain keeper contract
