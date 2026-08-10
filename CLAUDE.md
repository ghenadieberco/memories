# Memories

A responsive web app where a signed-in user organizes photos into dated albums ("memories"), browses them as a thumbnail grid or in a fullscreen viewer, and shares them with other users or via public links (view-only, or optionally open to guest uploads).

**Status:** live at <https://memories.ghenadie-berco.com> (Fly app `berco-memories`, region `iad`, 1 machine, Let's Encrypt cert; Neon Postgres in AWS `us-east-1`; public Tigris bucket `berco-memories-photos`; Neon Auth with email sign-up + verify-at-sign-up).

**Phases 0–3 are built, deployed, and verified working by the owner** — auth, memories, photo upload/optimization, grid and viewer, and Phase 3 sharing ("Shared with me", public `/m/[token]` links), which the owner confirmed end-to-end on 10 August 2026. **Phase 4 is empty by decision.**

**All social features are out of scope (D20)** — comments, likes, *and* people tagging. Don't build anything from requirements Section 3.7 (FR-SOC-1..5) without being asked. Tagging was built once and removed on request; the `comments`, `likes`, `persons`, and `photo_tags` tables remain in the schema, unused, on purpose.

Beyond the phased plan, three owner-requested additions are live: **guest photo contributions** (D21), **multi-select bulk delete**, and an **admin console with global maintenance mode** (D22). `/api/health?deep=1` writes to the live bucket — remove or protect it during hardening.

Two live workarounds for defects in `@neondatabase/auth@0.4.2-beta`, both documented in the plan and both to be re-tested when the SDK updates: `emailOtp.resetPassword` points at a 404 path (see `neonAuthPost`), and `auth.middleware()` redirects every non-GET request even with a valid session (see `proxy.ts` — this one silently broke every server action).

---

## Read the docs first

The `docs/` folder is the source of truth for this project. **Before writing or changing any code, read the docs relevant to the task and keep them in context.** Do not invent requirements, schema fields, stack choices, or visual styling that these documents don't already specify.

| Document | Authority over | Read it when |
|---|---|---|
| [docs/Memories-App-Requirements.md](docs/Memories-App-Requirements.md) | **What** to build — functional requirements (`FR-*`), non-functional requirements (`NFR-*`), data model, screen map, assumptions | Any feature work; always check the relevant `FR-` ID before implementing |
| [docs/Memories-Implementation-Plan.md](docs/Memories-Implementation-Plan.md) | **How** to build and deploy it — tech stack, architecture, project structure, env vars, SQL schema, phased build plan, deployment runbook | Scaffolding, wiring, schema/migration work, infra, deployment |
| [docs/UI-Style-Guide.md](docs/UI-Style-Guide.md) | **How it looks and reads** — color tokens, typography, glassmorphism recipe, spacing/radius, components, motion, a11y, voice & copy | Any UI, styling, or user-facing copy work |
| [docs/Current-Features.md](docs/Current-Features.md) | **What the app does today** — a plain-language catalogue of shipped behavior, plus a short list of known gaps | Orienting on the live product; checking whether something already exists before building it |
| [docs/Future-Functionalities.md](docs/Future-Functionalities.md) | **What is *not* in the build** — Section 1 deferred (`FF-*`, wanted later), Section 2 out of scope (declined) | Before starting anything that isn't already an `FR-`; to check whether an idea is parked or refused |
| [docs/memories-prototype.jsx](docs/memories-prototype.jsx) | Reference implementation of the intended look and interactions (single-file React prototype, mock data) | Building a screen or component — mine it for layout and behavior, don't ship it as-is |

**Conflict rule (from the plan, Section 0):** the requirements doc wins on *what*, the implementation plan wins on *how*. The style guide wins on appearance and copy. The prototype is illustrative, not authoritative.

---

## Working rules

- **Build one phase at a time**, in order, per the plan's Section 8 (Phase 0 foundation → 1 auth/account → 2 memories & photos core → 3 sharing & public links → 4 social). Finish a phase to its acceptance criteria before starting the next.
- **Treat the plan's Section 9 "Assumed defaults" (D1–D12) as binding** unless the user says otherwise. They resolve the requirements doc's open questions — don't re-open them mid-task.
- **Cite requirement IDs** (`FR-MEM-9`, `NFR-OPT`, `D5`, …) in commit messages, PR descriptions, and code comments where a non-obvious rule is being implemented.
- **Don't build anything in Future-Functionalities Section 2 "Out of scope"** (moved there from the plan's Section 12): face detection/recognition, timeline/map/search views, native mobile, user-configurable image optimization. Keep the schema and UI free of hooks for these.
- **Don't build Future-Functionalities Section 1 "Deferred" (`FF-*`) either** — download, video support, a larger viewer, slideshow. These are wanted eventually but unspecified; wait to be asked, and specify them into the requirements doc before writing code. Note **video moved out of "out of scope" into deferred** — it is no longer refused, but it is still not to be built unprompted.
- **When an `FF-*` item ships, move it in the same change**: delete its entry from Future-Functionalities and describe the new behavior in Current-Features, in that document's plain, user-facing voice. Give it a real `FR-` ID in the requirements doc on the way through. The two lists are meant to stay complementary — anything appearing in both, or in neither, is a bug in the docs.
- If a task requires a decision the docs don't cover, state the assumption and proceed — or ask, if getting it wrong would waste the work. Then propose the doc update rather than letting code and docs diverge.
- When behavior intentionally changes, **update the relevant doc in the same change** so `docs/` stays the source of truth.

---

## Non-negotiables

These come from the requirements' security/privacy sections and the plan's Section 10 checklist. Violating one is a bug regardless of what a task asks for:

- **Every authenticated DB access goes through the scoped access helper** (owner / accepted member / permission level). Never query a memory or photo by id alone.
- **The guest public route `/m/[token]` is the only unauthenticated *read* path.** It runs server-side only, selects strictly by `public_token` + `public_link_active`, and returns data for that single memory. No privileged credentials ever reach the browser.
- **There is exactly one unauthenticated *write* path: guest photo upload (D21)**, and it stays that way. It is allowed only via `getPublicMemoryForContribution()`, which additionally requires the owner's per-memory `public_can_contribute` opt-in, and it is rate-limited. Never add a second unauthenticated write, and never widen this one to editing or deleting. Guest uploads have `uploaded_by = NULL`, so only the memory owner can delete them.
- **Validate every request body with Zod at the server boundary.**
- **Image optimization is mandatory and not user-configurable** (`NFR-OPT`, `FR-PROF-4`): resize to longest edge ~2048 + WebP q~80, generate a ~400px thumbnail, extract EXIF `taken_at` **before** stripping metadata, discard the original (D5).
- **Serve images from the Tigris/R2 public URL/CDN** — never proxy image bytes through the app.
- **Deleting a memory or photo deletes its storage objects too** (no orphans).
- **Secrets live in Fly secrets / `.env.local`, never in the repo.** `.env.local` must stay gitignored.
- **Every mutation calls `assertWritable(userId)`** (D22) so maintenance mode actually freezes the app. If you add a server action or a write route, add the guard — there is no framework-level enforcement.
- **Joining `neon_auth.user` to `profiles` requires `u.id::text`** — the former is `uuid`, the latter `text`.

---

## Stack (see the plan, Section 1)

TypeScript · Next.js App Router · Tailwind + shadcn/ui · Drizzle ORM · Zod · `sharp` · yet-another-react-lightbox · lucide-react — hosted on **Fly.io**, with **Neon** (Postgres + Neon Auth) for data and auth, **Tigris** (S3-compatible; Cloudflare R2 as the alternative) for photos, and **Resend** for email.

Auth is handled by Neon Auth — do not hand-roll password hashing, sessions, verification, reset, or lockout, and do not re-create the `neon_auth` tables.

---

## Style in one line

Playful glassmorphism: cream canvas, drifting purple/orange light-orbs behind frosted-white panels, bright-purple identity with orange used only as an accent (dates, camera glyph, active toggle, contributor pill). Purple leads; one bold element per screen; keep colorful light behind every glass surface. Copy is active voice, sentence case, and an action keeps its name through the flow. Full tokens and component specs in [docs/UI-Style-Guide.md](docs/UI-Style-Guide.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
