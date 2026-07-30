# Paperclip AI — Agent Registry Integration

[Paperclip](https://github.com/paperclipai/paperclip) is an open-source agent management platform — "the app everyone uses to manage agents at work."

## How it fits

Paperclip provides a **unified registry** where each agent's identity, tools, missions, and memory are tracked in one queryable place. It replaces the ad-hoc `/opt/pauli-effect/agents/personas/` JSON files with a proper system.

## Current state

- `SKILL_PAPERCLIP=https://github.com/paperclipai/paperclip.git` is in the vault
- Not yet cloned or deployed
- The live system uses custom persona JSON files instead

## Integration plan (Phase 3 of the studio plan)

1. **Deploy Paperclip** on the VPS via Coolify (Docker)
2. **Register each agent** — Pi, Hermes, TARS, JARVIS — with their:
   - Identity (name, role, system prompt)
   - Tools (skills from `library/skills-icm/`)
   - Memory reference (JARVIS's library/shelves/)
   - Design system binding (point at `design-system/`)
3. **Wire agents to read from Paperclip** on boot — each agent's `server.js`/`server.py` fetches its config from Paperclip instead of local `config.json`
4. **Mission tracking** — Paperclip logs every mission dispatched (replaces the flat `missions/*.json` files)

## Design system binding

Each agent in Paperclip gets a `design_system` field pointing at this repo's `design-system/` folder. When TARS builds a UI, Paperclip tells him which taste rules to apply.

```yaml
agent:
  slug: tars
  design_system:
    taste_skill: design-system/taste-skill/
    uncodixfy: design-system/uncodixfy/
    brand_kit: design-system/brand-kit/
```
