# 500 — Skills and Patterns

## Catalogued skills

### free-llm-proxy-zte-installer
- **File:** `free-llm-proxy-zte-installer.md`
- **What:** Phase-gated ZTE master prompt for Free Claude Code proxy + smart router + browser harness
- **Fits:** Local/dev coding-agent cost layer (NOT production Hermes/TARS/Cosmos brains)
- **Target:** Any app repo (dashboard, Vercel apps, monorepos)
- **Proxy:** `http://localhost:8082` via `~/.fcc/.env`
- **Secrets:** Cosmo Vault / OFFLINE SECRET APPENDIX only; never commit keys
- **When to run:** Before heavy coding sessions to cut token cost
- **When NOT to run:** Blindly on live VPS agent units already on Mercury-2

### hermes-design-studio-workflow
- **File:** `/opt/pauli-effect/agents/hermes/DESIGN_STUDIO_WORKFLOW.md`
- **What:** 8-agent Karpathy Council design studio (Ralphy/Lena/Marco/Aurora/Bass/Blender/Scout)
- **Quality floor:** UDEC 8.5 (MOT/ACC blockers)
- **Trigger keywords:** design, landing, awwwards, cinematic, remotion, video, brand, UI polish

## Production LLM note
Fleet brains (Hermes, Cosmos-Pi, TARS, Cosmos-II) currently use **Mercury-2**
(`https://api.inceptionlabs.ai/v1`). The free proxy stack is parallel infrastructure
for development workstations and coding agents.
