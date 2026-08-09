# Memories

A responsive web app where a signed-in user organizes photos into dated albums ("memories"), browses them as a thumbnail grid or in a fullscreen viewer, shares them with other users or via public view-only links, and comments/likes/tags people on photos.

**Status:** specification only — no application code exists yet. The repo currently holds `README.md` and [docs/](docs/). Phase 0 of the implementation plan (scaffolding) has not been started.

---

## Read the docs first

The `docs/` folder is the source of truth for this project. **Before writing or changing any code, read the docs relevant to the task and keep them in context.** Do not invent requirements, schema fields, stack choices, or visual styling that these documents don't already specify.

| Document | Authority over | Read it when |
|---|---|---|
| [docs/Memories-App-Requirements.md](docs/Memories-App-Requirements.md) | **What** to build — functional requirements (`FR-*`), non-functional requirements (`NFR-*`), data model, screen map, assumptions | Any feature work; always check the relevant `FR-` ID before implementing |
| [docs/Memories-Implementation-Plan.md](docs/Memories-Implementation-Plan.md) | **How** to build and deploy it — tech stack, architecture, project structure, env vars, SQL schema, phased build plan, deployment runbook | Scaffolding, wiring, schema/migration work, infra, deployment |
| [docs/UI_STYLE_GUIDE.md](docs/UI_STYLE_GUIDE.md) | **How it looks and reads** — color tokens, typography, glassmorphism recipe, spacing/radius, components, motion, a11y, voice & copy | Any UI, styling, or user-facing copy work |
| [docs/memories-prototype.jsx](docs/memories-prototype.jsx) | Reference implementation of the intended look and interactions (single-file React prototype, mock data) | Building a screen or component — mine it for layout and behavior, don't ship it as-is |

**Conflict rule (from the plan, Section 0):** the requirements doc wins on *what*, the implementation plan wins on *how*. The style guide wins on appearance and copy. The prototype is illustrative, not authoritative.

---

## Working rules

- **Build one phase at a time**, in order, per the plan's Section 8 (Phase 0 foundation → 1 auth/account → 2 memories & photos core → 3 sharing & public links → 4 social). Finish a phase to its acceptance criteria before starting the next.
- **Treat the plan's Section 9 "Assumed defaults" (D1–D12) as binding** unless the user says otherwise. They resolve the requirements doc's open questions — don't re-open them mid-task.
- **Cite requirement IDs** (`FR-MEM-9`, `NFR-OPT`, `D5`, …) in commit messages, PR descriptions, and code comments where a non-obvious rule is being implemented.
- **Don't build anything in the plan's Section 12 "Out of scope"**: face detection/recognition, timeline/map/search views, native mobile, user-configurable image optimization, video. Keep the schema and UI free of hooks for these.
- If a task requires a decision the docs don't cover, state the assumption and proceed — or ask, if getting it wrong would waste the work. Then propose the doc update rather than letting code and docs diverge.
- When behavior intentionally changes, **update the relevant doc in the same change** so `docs/` stays the source of truth.

---

## Non-negotiables

These come from the requirements' security/privacy sections and the plan's Section 10 checklist. Violating one is a bug regardless of what a task asks for:

- **Every authenticated DB access goes through the scoped access helper** (owner / accepted member / permission level). Never query a memory or photo by id alone.
- **The guest public route `/m/[token]` is the only unauthenticated data path.** It runs server-side only, selects strictly by `public_token` + `public_link_active`, and returns read-only data for that single memory. No privileged credentials ever reach the browser.
- **Validate every request body with Zod at the server boundary.**
- **Image optimization is mandatory and not user-configurable** (`NFR-OPT`, `FR-PROF-4`): resize to longest edge ~2048 + WebP q~80, generate a ~400px thumbnail, extract EXIF `taken_at` **before** stripping metadata, discard the original (D5).
- **Serve images from the Tigris/R2 public URL/CDN** — never proxy image bytes through the app.
- **Deleting a memory or photo deletes its storage objects too** (no orphans).
- **Secrets live in Fly secrets / `.env.local`, never in the repo.** `.env.local` must stay gitignored.

---

## Stack (see the plan, Section 1)

TypeScript · Next.js App Router · Tailwind + shadcn/ui · Drizzle ORM · Zod · `sharp` · yet-another-react-lightbox · lucide-react — hosted on **Fly.io**, with **Neon** (Postgres + Neon Auth) for data and auth, **Tigris** (S3-compatible; Cloudflare R2 as the alternative) for photos, and **Resend** for email.

Auth is handled by Neon Auth — do not hand-roll password hashing, sessions, verification, reset, or lockout, and do not re-create the `neon_auth` tables.

---

## Style in one line

Playful glassmorphism: cream canvas, drifting purple/orange light-orbs behind frosted-white panels, bright-purple identity with orange used only as an accent (dates, camera glyph, active toggle, contributor pill). Purple leads; one bold element per screen; keep colorful light behind every glass surface. Copy is active voice, sentence case, and an action keeps its name through the flow. Full tokens and component specs in [docs/UI_STYLE_GUIDE.md](docs/UI_STYLE_GUIDE.md).
