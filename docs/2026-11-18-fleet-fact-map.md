# Agent fleet integration: verified fact map (2026-11-18)

**Mode:** READ-ONLY architecture baseline, no production deployment.
**Target:** Unify ChatGPT/MASTER MODE, Hermes, VIBE FORGE, Maus Bot, StarNet and Paperclip without duplicate orchestration, credentials or authority.
**Commercial value:** Reusable idea-to-revenue workflow delivering evidence-backed paid offers without unnecessary app builds.
**Proof level:** `VERIFIED` direct runtime or current GitHub evidence; `SOURCE CLAIM` documented but not live checked; `NOT VERIFIED` no valid operational receipt. Do not promote claims into production proof.

## Existing control systems

| Component | Intended role | Evidence / status | Next gated proof |
|---|---|---|---|
| ChatGPT/MASTER MODE | Owner-facing intake, decisions, approvals, control tower | Existing Vibe MASTER MODE workstream; live cross-agent end-to-end dispatch not proven in this audit | Send and receipt a read-only mission |
| Hermes Agent | One primary coordinator, registry of work assignments | Surface `hermes --version` returned v0.16.0; Hermes dashboard HTTP 200 on localhost port 9119; OpenRouter/DeepSeek configured; normal-profile model query hit Vercel MCP OAuth; an isolated temporary-home model handshake returned `FORGE_HERMES_MODEL_READY` via OpenRouter/DeepSeek without changing the regular profile | Diagnose ordinary-profile MCP OAuth separately; verify real authenticated stage dispatch and remote assignment |
| VIBE FORGE | One 13-station idea-to-market workflow, not another agent runtime | Private ChatGPT plugin v0.2.0; Vibe PR 89 and Hermes PR 183 are draft; Hermes installed `vibe-forge`, `proven-better-new`, `pm-skills-navigator`, `thinking-expert`, `pricing-strategist`, `yc-startup-fundamentals`. 15 targeted tests passed both repos locally | Clear repository review/Nix gates; invoke real mission with evidence receipts |
| OpenMausBot | Bounded isolated worker/task executor, not a competing chief-of-staff | Surface OpenMausBot.exe installation, local `.openmausbot` with two bot directories and routines/tasks/event records; desktop process was NOT running when checked. `pauli-mausbot/DEPLOYMENT-STATE.md` claims isolated cold harness active on server, NOT full model-backed readiness | Fresh server session/health/provider-auth check; run one harmless sandbox bot task and confirm receipt |
| StarNet | Optional visual capability-scoped workspace / experimental harness | Repo `executiveusa/pauli-starnet`, default `feat/harness-backend`; PR #105 open/unmerged. Surface has StarNet workspace records in Roaming but localhost:8787 refused connection, no StarNet.exe observed in known install location and no starnet.exe process | Confirm actual intended host, version, project branch and run safe sidecar HTTP smoke; avoid duplicate schedulers |
| Paperclip | Proposed shared work registry/assignment record | `pauli-studio-control-plane/PAPERCLIP.md` describes a planned integration and says not deployed at that source revision; does not prove current state | Verify current server deployment and real agent registry records without modifying existing agents |
| Pauli Studio Control Plane | Historical source for Pi/Hermes/TARS/JARVIS fleet architecture | `README.md` describes a four-agent fleet and Paperclip phase; not independently verified live | Confirm live process owners, endpoints and registry ownership with Claude's server-side evidence |

## Proposed authority contract — not implemented yet

```text
Owner -> ChatGPT MASTER MODE [decision / approval]
          |
          v
        Hermes [sole mission coordinator + stage dispatch]
          |
          +-- VIBE FORGE [evidence-led product process, skill choice]
          +-- Paperclip [work ledger, if genuinely deployed]
          +-- Maus Bot [sandbox execution with a bounded capability grant]
          +-- StarNet [optional isolated visual/team harness]
          +-- Other named agents [specific delegated tasks, no parallel unsupervised chief]
          |
          v
Independent reviewer -> proof receipt -> owner release approval -> verified delivery
```

No other controller may silently write production state or own the same workflow's approvals. Avoid double cron, double memory stores, duplicated task IDs and independent spend authorities. Grant tools per job, least privilege; keep credentials only on their designated systems. Do not claim Paperclip is live without evidence.

## Known FORGE release blockers

- Vibe `executiveusa/vibe-engineering#89`: Quality Gate green, but referenced reusable code-review workflow `executiveusa/open-code-review/.github/workflows/vibe-review-standard.yml@main` does not currently exist; security review missing. Earlier code review clean on a prior exact head; subsequent changes require new independent review.
- Hermes `executiveusa/pauli-hermes-agent#183`: targeted local Python tests green (15); GitHub Nix fails because offline npm cache lacks `next`. Full CI test job has also been cancelled on some attempts; successful lint/PR/supply-chain checks do not establish a complete merge gate.
- No PR was merged or deployed by this audit. Surface `pauli-hermes-agent` working tree contains extensive pre-existing modifications, including local state files. Never reset/clean/rebase it without preserving and auditing user changes.

## First safe cross-system acceptance test

1. **Read-only intake:** give Hermes a specific existing product and 30-day commercial objective; record run ID and permission ceiling.
2. **FORGE dispatch:** prove Stage 00 identity/authority, then Stage 01 repo/customer evidence; select only installed audited skills.
3. **One worker assignment:** authorize exactly one harmless Maus sandbox job, no network secrets, no customer outreach, no writes outside its workspace; capture start/end/status and trace ID.
4. **Paperclip / StarNet observation:** if verified available, attach the same trace ID read-only; do not create a second mission or restart a second orchestrator.
5. **Review and close:** independent checks, explicit failure receipts, actual cost, rollback test, and owner disposition. No unverified billing/outreach/deploy.

## Questions for Claude's server-side architecture explanation

Ask Claude for a **current-state, evidence-first report**, not an intended architecture:
- What host/process/service and version runs Hermes, Maus, StarNet, Paperclip, Pi, JARVIS and TARS **today**?
- Which component is the canonical mission queue/ledger? Which can dispatch tasks? Are any cron routines duplicated?
- For each arrow in a proposed sequence, identify caller, callee, protocol, endpoint/path (redacted), auth boundary, data passed, retry/timeout, idempotency key, receipt ID and rollback.
- Does the Maus cold harness perform real provider-backed work, or only pass cold health checks? Where is desktop/OpenMausBot state stored and how is it separated from cloud state?
- Is StarNet an active independent harness or only a repository/workspace? Does it import Hermes as a one-time migration or talk to an active Hermes process?
- Is Paperclip running? Where are agent records and actual assignments kept? What integration is implemented vs planned?
- What is one successful live cross-agent mission with timestamps, sanitized logs, status, cost and reviewer proof?
- What existing code paths can be reused to implement FORGE's persistent per-stage receipts? Which files/branches currently own them?
- Provide independent validation commands and redacted evidence, not secrets.

## Required decision packet

**DECISION:** HOLD on orchestration consolidation and cross-agent production automation pending real connectivity receipts.
**CHANGES:** This document only; no production/system settings.
**PROOF:** Surface runtime checks, installed skill list, repository contents and GitHub PR CI evidence (2026-11-18).
**STATUS:** PARTIAL: Hermes UI works; Maus cold harness documented; StarNet runtime offline on Surface.
**COMMERCIAL IMPACT:** No paid lead, payment or revenue established by this audit.
**RISKS:** Multiple orchestrators, unverified service health, OAuth prompt, licensing of third-party skills, unreviewed builds.
**ROLLBACK:** Revert this documentation PR; installed skill rollback is separate `hermes skills uninstall` or folder-specific restore only after dependency check.
**NEXT:** Review Claude's current live architecture, select one reversible cross-agent mission, and reconcile the implementation with this fact map.
**HUMAN APPROVAL:** Required for outreach, spending, production changes, privilege expansion or migrations.
