# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ほしふみ (hoshifumi)** is a daily pre-sleep journaling SaaS — a 5-minute ritual for facing yourself before bed. The session combines fixed scaffolding questions with an AI-generated follow-up that asks "why did you feel that way" based on what the user just wrote. AI accumulates these inputs and generates monthly pattern reports.

> Rename history: **みっつ (mittsu)** → **いとなみ (itonami)** on 2026-05-14 (ADR-011, ADR-015) → **ほしふみ (hoshifumi)** on 2026-05-16 (ADR-018, after worldview "夜、ふとんから星を見上げるアプリ" crystallized and "営み" no longer matched cosmic/atmospheric brand). See `docs/DECISIONS.md` for full history. The repository folder was also renamed to `hoshifumi/` on disk on 2026-05-16.

- **Stage**: Pre-PMF, post-v0
- **v0 status**: Completed (Magic Link auth, single Basic template, calendar view, streak counter)
- **Current focus**: Personal 30-day usage test, then β-version development
- **Owner**: Solo developer (Japanese frontend engineer, ~10 years experience)
- **Language**: All user-facing copy in Japanese; code, comments, commits in English (mixed JP comments acceptable for domain terms)

## Tech Stack (fixed - do not change without strong reason)

- **Framework**: Next.js 15.5+ App Router with React 19
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS v4 (uses `@import "tailwindcss"` and `@theme` block, NOT v3 config)
- **DB/Auth/Storage**: Supabase (Postgres + RLS + Magic Link auth)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`), default model `claude-sonnet-4-6`, with fallback to `claude-haiku-4-5` for cost-sensitive operations
- **Date handling**: `date-fns` + `date-fns-tz` (always treat dates as `Asia/Tokyo`)
- **Icons**: `lucide-react`
- **Hosting target**: Vercel
- **PWA**: Native Next.js manifest, iOS Safari focus

## Critical Architectural Decisions

### Server Actions over API Routes
All mutations go through Server Actions in `lib/server-actions/`. API Routes are only for: Stripe webhooks, Vercel Cron jobs, and OAuth callbacks.

### Date is always JST
Never use raw `new Date()` for entry dates. Use `todayJST()` from `lib/utils/date.ts`. Entries are uniquely keyed by `(user_id, entry_date)` where `entry_date` is a JST calendar date.

### RLS is the source of truth
Never bypass RLS with service role key in user-facing code paths. Service role is only for: trigger functions, cron jobs, admin scripts.

### Answers schema is multi-column intentionally
The `answers` table has `value_number`, `value_text`, `value_choice` as separate columns rather than a JSON blob. This is to make AI prompt construction and analytical queries straightforward. Do not refactor into JSON.

### Template is hardcoded in v0
Currently only "basic" template exists. When adding additional templates in v1.0, DO NOT add a `templates` table yet. Define templates as TypeScript constants in `lib/constants/template.ts` with a discriminated union by `template_name`. Move to DB-backed templates only when custom templates (v1.1+) are needed.

### The "5-minute ritual" flow includes an AI follow-up step (ADR-012)
The daily flow is: fixed Q1 (body sensation tap) → fixed Q2 (free text on today's event) → **AI-generated follow-up question** (Claude reads Q1+Q2 and asks one personalized "why" question) → fixed Q3 (free text closure for tomorrow). The AI step is part of v1.0 core, not a Pro-only feature. Detailed prompt/multi-turn/Free-vs-Pro design is still TBD as of 2026-05-14; treat anything in `lib/server-actions/entries.ts` that doesn't yet handle the AI step as a known gap.

### AI is the quoter, not the interpreter (ADR-016, 引用係原則)
This is the foundational rule for every AI surface (daily follow-up, monthly report, callbacks). **AI may quote, surface, curate, ask back. AI may NOT summarize, label, diagnose, advise, or announce patterns with interpretation.** The user does all interpretation; AI does selection and arrangement. When designing any AI feature, ask: "is this quoting or interpreting?" If interpreting, redesign.

### Past-entry callback on /today/done (ADR-017)
After submission, the done page may surface one past entry from the user's own history ("数日前のあなたが、こう書いてた"). Uses a γ stage model — new "time distance" ranges unlock at entry-count milestones (5, 12-15, 21-25, 30+, …, 365日 anniversary). Between stages, cool-down + probabilistic refire from already-unlocked ranges. Stage 1 fires deterministically on the 5th entry as the onboarding hook. No AI commentary on the callback itself; the entry is shown verbatim with date + body-sensation emoji. See SPEC §8 for the full algorithm.

### Worldview / design north star (ADR-019)
The product image is **「夜、ふとんから星を見上げるアプリ」** — receptive posture, upward gaze, the safety of being wrapped, a constellation of small warm points accumulating over time. This image drives every visual, copy, motion, AI behavior, and product decision. Litmus test: *"does this fit someone lying in bed, looking up at their own accumulating sky of journaling stars?"*

**Canonical source**: `docs/DECISIONS.md` ADR-019 (decision + reasoning).
**Daily operational reference**: `docs/WORLDVIEW.md` (yes/no anti-pattern catalog, color tokens, typography, copy patterns, motion principles, iconography rules — consolidated from multiple ADRs/PRD into one place to check before designing any new surface).

Quick mental model when extending: **Past entries = stars accumulating** in user's night sky; **AI = constellation pointer, never namer** (ADR-016); **Brand mark = thin waxing crescent** (`#f5d49a`) on deep indigo (`#0f0f23`).

## Project Structure

```
hoshifumi/
├── app/
│   ├── (root)/                  # Public routes
│   │   ├── page.tsx             # Redirects based on auth
│   │   └── login/page.tsx       # Magic Link form
│   ├── auth/callback/route.ts   # OAuth callback
│   ├── today/                   # Daily pre-sleep ritual input flow
│   ├── calendar/                # Past entries view
│   ├── settings/                # Account / preferences
│   └── layout.tsx               # Root layout
├── components/                  # Shared UI components
├── lib/
│   ├── supabase/                # Supabase clients (client/server/middleware)
│   ├── server-actions/          # All mutations
│   ├── utils/                   # date, streak, cn, etc
│   ├── constants/               # Template definitions
│   └── types.ts                 # Shared types
├── supabase/migrations/         # SQL migrations
└── proxy.ts                     # Auth check (Next.js 16: renamed from middleware.ts)
```

## Development Workflow

### Before starting any task
1. Read `docs/PRD.md` to understand the product context
2. Read `docs/ROADMAP.md` to confirm task scope vs. version
3. Check `docs/DECISIONS.md` for prior decisions on similar topics

### Common commands

```bash
# Type check (run before commit)
npm run typecheck

# Production build (verifies all routes generate)
npm run build

# Dev server
npm run dev
```

### Required before declaring task complete
1. `npm run typecheck` passes with no errors
2. `npm run build` succeeds with no errors
3. If schema changed, new migration file added under `supabase/migrations/`
4. If new env vars added, `.env.example` updated AND mentioned in commit message
5. If new dependencies added, justify in commit message

### When implementing new features
- Reference `docs/SPEC.md` for the relevant feature section
- Follow patterns established in existing code (look at `lib/server-actions/entries.ts` for action patterns)
- Match existing UI style (rounded-2xl, primary-500 for CTAs, neutral-* for text)
- All user-facing text in Japanese
- Loading states use `useTransition` for Server Actions

## Code Style

### TypeScript
- Strict mode is on, no `any` unless absolutely necessary (then document why)
- Prefer `type` for unions/intersections, `interface` for object shapes used as props
- Server Actions: explicit input/output types
- Use `@/*` path alias for imports

### React/Next.js
- Server Components by default, `"use client"` only when needed (state, effects, browser APIs)
- Server Actions in dedicated files under `lib/server-actions/`, marked with `"use server"`
- Form handling via FormData + Server Actions, not API routes
- Use `useTransition` for pending states on Server Action calls

### Styling
- Tailwind classes only, no custom CSS except in `globals.css`
- Use `cn()` from `lib/utils/cn.ts` for conditional classes
- Color tokens: `primary-*` for brand, `neutral-*` for text/bg
- Border radius scale: `rounded-xl` for buttons/cards, `rounded-2xl` for sections, `rounded-full` for chips

### Naming
- File names: kebab-case for routes, PascalCase for components
- Server Actions: verbs (`submitEntry`, `signOut`)
- Component props: prefer object destructuring in signature

## Known Constraints

- **No native push notifications in v0**: Web Push API only, iOS PWA needs iOS 16.4+
- **No offline mode in v0**: All requests require network
- **No image uploads in v0**: Photo attachment is v1.2+
- **No voice input in v0**: Voice-to-text is v1.2+
- **Single timezone (JST) in v0**: International support is v2.0+

## Testing

Currently no automated tests. Validation strategy:
1. Manual smoke testing on iOS Safari (target device)
2. Type system as primary safety net
3. Build success as integration check

When tests are added (likely v1.1): Vitest for utilities, Playwright for E2E.

## Deployment

Vercel + Supabase. See `docs/DEPLOYMENT.md` for the full setup checklist.

## Files NOT to edit directly

Owner-managed. Propose diffs in chat, but never edit directly:

- `docs/PRD.md` — product strategy
- `docs/DECISIONS.md` — ADRs are **append-only**; never modify or rewrite existing ADRs (use "superseded by ADR-NNN" pattern instead)
- `docs/ROADMAP.md` — owner manages version planning

## Common Q&A

Brief guidance for recurring questions. See `docs/DECISIONS.md` for "why" context on each.

- **Add tests?** No tests in v0. Add when: same bug recurs ≥2 times / implementing complex logic (streak calc, AI prompt construction) / before v1.0 launch (Playwright login → submit happy-path E2E).
- **Refactor X to clean it up?** Probably not. Exceptions: X blocks a specific feature / X recently caused a bug / refactor fits in <30 min.
- **Update dependencies?** Only for: security patches / required by a new feature / explicit owner request. Don't update just to stay current.
- **Owner asks to "make it cleaner"?** Open `app/globals.css` first — look at existing tokens. Don't introduce new colors/spacings. Look for consistency drift in existing UI before adding anything. If a real change is needed, propose 2–3 code mockups for the owner to choose. Always check against ADR-019 (worldview): does it fit "夜、ふとんから星を見上げる"?
- **Owner requests an anti-goal feature?** Push back. Quote the specific anti-goal from `docs/PRD.md` §3. Propose an alternative that meets the underlying need. Example: "add streak loss notifications" → quote ADR-008 (no punishment) → propose "gentle reminder after 3 days of disuse".
- **Owner requests AI interpretation?** Quote ADR-016 (引用係原則) and push back. AI may quote/select/arrange/ask back; AI may NOT summarize/label/diagnose/advise/announce patterns. Redesign as a curation primitive.

## Where to find things

| Looking for | Location |
|---|---|
| Why a decision was made | `docs/DECISIONS.md` (especially recent ADR-011 〜 ADR-020) |
| Which features are in scope for this version | `docs/ROADMAP.md` |
| How feature X is implemented | `docs/SPEC.md` (search for X) |
| Product value / anti-goals | `docs/PRD.md` §3 |
| User personas | `docs/PRD.md` §4 |
| Tech stack rationale | this file + `docs/DECISIONS.md` |
| Deployment steps | `docs/DEPLOYMENT.md` |
| File layout / where to add new things | `docs/STRUCTURE.md` |
| Code patterns (Server Action, Form, type) — quick reference | `docs/API-REFERENCE.md` |
| Worldview definition (canonical decision) | `docs/DECISIONS.md` ADR-019 |
| Worldview operational reference / NG catalog / copy & tone criteria | `docs/WORLDVIEW.md` |
| Design system — tokens & component specs for AI agents | `docs/DESIGN.md` (Stitch 9-section format) |
| Motion spec (duration / easing / use cases / anti-patterns) | `docs/MOTION.md` |
| How to design visually in Pencil | `docs/PENCIL.md` |
| Next actions / TODO / open decisions (canonical) | `docs/NEXT-ACTIONS.md` |
| Phase 0 self-test friction log | `docs/FRICTION-LOG.md` |

## When in doubt

1. Check `docs/SPEC.md` for spec details
2. Check `docs/DECISIONS.md` for "why" context
3. Ask the user — but propose a concrete answer first, don't ask open-ended questions
