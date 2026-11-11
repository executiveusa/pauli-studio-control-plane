# Cosmos-Pi — desktop and cloud release runbook

## Source of truth and boundaries
- Full coding engine: executiveusa/pauli-pi-agent (Pi CLI with real coding tools).
- Studio control plane: executiveusa/pauli-studio-control-plane (Cosmos personality, Hermes, ICM, skill catalog).
- cosmos-pi/server.js is a lightweight LLM responder, not an autonomous code executor. Never label its model-generated mission response a code change.
- The Pi agent must run in the actual target repo/worktree to modify files. Its own project AGENTS.md must explain how to load studio rules.
- Canonical Heart/Soul live in the pi-agent company's directory. Set PI_COMPANY_ROOT to that checked-out company directory for the Cosmos HTTP service.
- Context is now bounded at a higher limit, never silently truncated. Missing optional source files are not silently fabricated.

## Private service configuration — mandatory before rollout
- Generate unique random AGENT_ACCESS_TOKEN for Cosmos and share the same secret to trusted callers as PI_AGENT_ACCESS_TOKEN.
- Set a new unique SKILLS_ACCESS_PASSWORD on the skill API and skill-write clients; the previously hardcoded credential must be rotated and historical exposure investigated.
- Never put these tokens into git, logs, chat, or ICM memory.
- Bind agent services to loopback; use a private Tailscale tailnet, authenticated SSH, and scoped ACLs for desktop-to-VPS access.
- Verify the actual service manager EnvironmentFile/secret injection and restart only affected units after review. Missing tokens fail closed.
- Audit other hardcoded values in the repo independently before any public exposure.

## Windows desktop setup
Requirements: Git Bash (Git for Windows), supported Node.js, VS Code optional, Tailscale.
PowerShell commands:
    winget install --id Git.Git --exact
    winget install --id OpenJS.NodeJS.LTS --exact
    npm install -g @mariozechner/pi-coding-agent
    git clone https://github.com/executiveusa/pauli-studio-control-plane.git "$HOME\src\pauli-studio-control-plane"
    cd "$HOME\src\pauli-studio-control-plane"
    pi
Use Pi /login or securely configured provider credentials. Open Pi in the repo being worked on; clone the pi-agent framework only if editing the Pi harness itself.

## VPS setup
- Linux VPS hosts Hermes, ICM/Amentis, and the skills registry. Pi CLI may run on a non-root service account in isolated worktrees for cloud coding.
- Keep 4717, 4800, and 4820 private. Tailscale makes the VPS accessible from Windows without opening agent APIs to the internet.
- Capture `systemctl cat` unit definitions and current commit before changes. Ensure callers forward the new bearer token.
- For a desktop that can sleep, report desktop jobs offline instead of pretending work continues. Use VPS Pi worker if true always-on execution is required.

## Tests and rollback
1. Run node --check on changed JavaScript and a mock-provider integration test verifying the full system prompt and auth.
2. Confirm Heart, Soul, agent contract, and guardrails are present in the model request; full prompt remains within allowed context limits.
3. Confirm unauthorized requests fail; authorized Hermes dispatch and skills execution pass.
4. Independently review security changes, then test a real Pi tool action in a disposable Git worktree.
5. Only then merge and obtain deployment approval. Back up environment/service definitions and revert to previous commits if checks fail.
