# AGENTS.md — THE PAULI EFFECT Mission Control

> **Director:** Bambú (Jeremy Bowers)
> **Method:** ICM — Interpretable Context Methodology (Jake Van Clief)
> **Rule:** The folder tree IS the orchestration framework. No hidden multi-agent frameworks.
> **Quality floor:** UDEC 8.5. Nothing ships below this. Ever.

---

## WHO WE ARE

The Pauli Effect is a **faceless holding company** that secretly connects seven independent brands. On the surface, each company operates independently with its own owner and clients. Behind the scenes, Bambú sees everything.

Think Marvel: the X-Men assemble together, but Wolverine also has his own solo comic. Same universe, separate stories, one editor-in-chief.

## THE SEVEN COMPANIES

| Company | Owner | Type |
|---------|-------|------|
| The Pauli Effect | Bambú (director) | Holding (faceless parent) |
| Kupuri Media | Ivette | For-profit |
| AFROMATIONS | Tyshawn Morehead | For-profit |
| Cheggie Media | Aleksa (Serbia) | For-profit |
| Macs Digital Media | Stacy McSwain | For-profit (partner) |
| Posta Tees | Stavarai McSwain | For-profit |
| My Web Lane | Akash (India) | For-profit (partner) |

## THE FOUR AGENTS

| Agent | Role | Tech | Port |
|-------|------|------|------|
| **HERMES** | Orchestrator — receives missions, dispatches to agents, Telegram gateway | Nous Hermes | — |
| **COSMOS** (Pi) | Personal agent + engineering lead — your daily driver, reads the brain | TypeScript | 4717 |
| **TARS** | Voice mission agent — builds apps, takes over screen | Python/Claude Code | 4321 |
| **COSMOS-II** (Jarvis) | Second brain manager — graph nodes/edges, Amentis Library | Python | 4719 |

## SHARED BROWSER BUS

Obscura is the preferred browser runtime for agent web interaction and verification across the fleet. It is infrastructure, not a new agent.

Execution ladder:
1. Existing structured API/tool source when it can satisfy the task.
2. Obscura for DOM/CDP browser interaction, monitoring, and proof capture.
3. Playwright/Chromium only when Obscura has a compatibility or rendering gap.
4. Full computer-use/desktop control only when browser automation is insufficient.

Agent responsibilities:
- **HERMES:** choose and dispatch browser-capable work through the shared capability; do not duplicate browser implementations.
- **COSMOS (Pi):** consume the browser capability through a provider-agnostic abstraction for engineering and agent workflows.
- **TARS:** prefer Obscura before escalating to Chromium or full screen takeover.
- **COSMOS-II (Jarvis):** use browser access for evidence gathering; never persist credentials/cookies into durable memory.
- **Watcher/verification services:** use Obscura as the default runtime for production checks, screenshots, console/network inspection, and change detection.

Proof standard for web-facing work: a deploy or tool success response is not production proof. Where applicable preserve final URL, expected page state/text, material console/network failures, screenshots, timestamp, commit SHA, and deployment identifier.

Security standard:
- no unrestricted credentials in browser prompts, page content, logs, screenshots, or memory;
- scoped and isolated authenticated sessions;
- private-network access denied by default unless explicitly required;
- autonomous targets bounded by policy/domain allowlists and rate limits;
- browser sessions disposable after sensitive workflows.

Browser-provider details must remain behind a shared abstraction so Obscura can be replaced without rewriting agent logic.

## THE AMENTIS LIBRARY (SECOND BRAIN)

All knowledge lives in `/opt/pauli-effect/library/shelves/` — 7 shelves:

```
100-IDENTITY                  ← who we are, brand systems, voice
200-STRATEGY-AND-DOCTRINE     ← business strategy, ICM method, mental models
300-AGENTS-AND-PEOPLE         ← team members, agent identities, roles
400-CLIENTS-AND-PROJECTS      ← client work, project records, deliverables
500-SKILLS-AND-PATTERNS       ← reusable skills, code patterns, templates
600-OPERATIONS                ← VPS, Supabase, deployments, runbooks
700-MEMORY-AND-REFLECTION     ← daily logs, lessons learned, heartbeat
```

All agents read from the Library. The folder structure IS the knowledge graph.

## NON-NEGOTIABLE RULES

1. **No slop.** No generic AI card blocks, no emoji soup, no cheerful filler. Technical prose.
2. **Humans at the gates.** Hard blocks: legal, financial >$100, destructive ops, production deploys, force-push. Require Bambú's explicit approval.
3. **Revenue traces.** Every action traces to a mission, an active client goal, or a direct revenue hypothesis.
4. **The Library is the source of truth.** Read from it. Do not replicate into context.
5. **One thing at a time.** Ship one thing before starting three.
6. **No emojis in code or commits.** Lucide icons only (MIT licensed).

## HOW TO NAVIGATE (ICM)

Read in this order, only what you need:

```
AGENTS.md              ← you are here. Global identity.
CONTEXT.md             ← router: which stage/agent to activate
library/shelves/       ← the Second Brain (7 shelves)
agents/*/CONTEXT.md    ← per-agent stage contracts
guardrails/            ← policies all agents obey
companies/*/           ← per-company client work
```
