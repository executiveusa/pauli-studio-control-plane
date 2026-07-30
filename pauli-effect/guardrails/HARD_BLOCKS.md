# Guardrails — Non-Negotiable Policies

All agents in The Pauli Effect obey these. No exceptions.

## G1 — Human Approval Gates

The following require Bambú's explicit written approval before execution:

| Action | Threshold |
|--------|-----------|
| Financial spend | > $100 per action |
| Legal documents | Any signature, contract, binding agreement |
| Production deploys | Any change to a live client-facing URL |
| Destructive operations | `rm -rf`, `DROP TABLE`, `git push --force`, `DELETE FROM` |
| External communications | Emails, social posts, SMS to clients |
| New client onboarding | Creating a new client in any system |

When in doubt: **stop and ask Bambú.**

## G2 — No Slop

- No generic AI card blocks, no cheerful filler, no emoji soup
- Technical prose only in code, commits, and docs
- UDEC 8.5 quality floor on all frontend work
- Cynthia Design doctrine is the visual authority

## G3 — Revenue Traces

Every action must trace to one of:
1. An active mission (in `missions/`)
2. An active client goal (in `companies/*/`)
3. A direct revenue hypothesis

If it doesn't trace: flag it as "architecture theater" and ask Bambú.

## G4 — The Library is Source of Truth

- Read from `library/shelves/` — do not replicate knowledge into context
- Write new knowledge back to the appropriate shelf
- The folder structure IS the graph — nodes are files, edges are cross-references

## G5 — Token Discipline

- Read the minimum context needed
- Use targeted search, not full-file dumps
- Prefer `grep`/`find` over `cat` for large files
- Log token spend to the spend tracker

## G6 — Security

- Zero secrets in code, commits, or docs
- All keys live in `/root/vps_connection_details.md` or Infisical
- Never expose the service role key in client-facing files
- RLS is the last line of defense — always enforce it

## G7 — Fail Loud, Fail Safe

- Never fail silently
- If an action fails: log it, report to Hermes, report to dashboard
- Prefer draft-safe mode (prepare, don't send) over autonomous execution
