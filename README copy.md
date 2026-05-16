# Mittsu - Handoff Package

This package contains everything Claude Code needs to take over development of the みっつ project.

## How to use this package

1. **Unzip both this package AND the `mittsu.zip` (the actual project code)**
2. **Place the `docs/` folder and `CLAUDE.md` file at the project root**:

```
your-project-location/
├── CLAUDE.md              ← from this package
├── docs/                  ← from this package
│   ├── PRD.md
│   ├── SPEC.md
│   ├── ROADMAP.md
│   ├── DECISIONS.md
│   ├── DEPLOYMENT.md
│   ├── HANDOFF.md
│   ├── FRICTION-LOG.md
│   └── API-REFERENCE.md
├── app/                   ← from mittsu.zip
├── components/            ← from mittsu.zip
├── lib/                   ← from mittsu.zip
├── ... (rest of project)
```

3. **Open the project root in Claude Code**:
```bash
cd your-project-location
claude
```

4. **Claude Code will automatically read `CLAUDE.md`** and gain full context.

## What's in this package

| File | Purpose |
|---|---|
| `CLAUDE.md` | Operating manual for Claude Code (read first, every session) |
| `docs/HANDOFF.md` | Initial briefing on current state and next steps |
| `docs/PRD.md` | Product requirements (the "why" and "what") |
| `docs/SPEC.md` | Technical specification (the "how to build") |
| `docs/ROADMAP.md` | Version-by-version scope |
| `docs/DECISIONS.md` | Architectural decision records (ADRs) |
| `docs/DEPLOYMENT.md` | Production deployment guide |
| `docs/FRICTION-LOG.md` | Template for recording Phase 0 self-test issues |
| `docs/API-REFERENCE.md` | Quick reference for existing functions/types |

## Reading order

For Claude Code's first session on this project, the recommended reading order is:

1. `CLAUDE.md` (5 min)
2. `docs/HANDOFF.md` (5 min) ← Most important for first session
3. `docs/PRD.md` (10 min)
4. `docs/ROADMAP.md` (3 min)
5. Skim `docs/SPEC.md` to know where to look
6. Skim `docs/DECISIONS.md` to know what's been decided
7. Skim `docs/API-REFERENCE.md` to know what exists

Total ~30 minutes for full context.

## Maintenance

These docs should be updated as the project evolves:

| File | When to update |
|---|---|
| `CLAUDE.md` | When patterns or commands change |
| `docs/PRD.md` | Only with owner approval (strategy doc) |
| `docs/SPEC.md` | After implementing features |
| `docs/ROADMAP.md` | When versions ship or scope changes |
| `docs/DECISIONS.md` | Append new ADRs when significant choices made |
| `docs/API-REFERENCE.md` | When public functions/types change |
| `docs/HANDOFF.md` | When phase changes (e.g., Phase 0 → v1.0 work) |

## Version of this package

Generated: 2026-05-10
Reflects: mittsu v0 (complete, not yet deployed)
