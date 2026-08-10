# Memories — Implementation Plan

| | |
|---|---|
| **Product** | Memories |
| **Companion doc** | `Memories-App-Requirements.md` (v1.2) — the source of truth for *what* to build |
| **This doc** | *How* to build and deploy it |
| **Version** | 2.0 |
| **Date** | 9 August 2026 |
| **Change in v2.0** | Stack moved to **Fly.io + Neon (+ Neon Auth) + Tigris/R2**; added a full **Deployment** section (Section 11) |

---

## 0. How to use this document

Build **one phase at a time**. Each phase has scope, tasks, and acceptance criteria mapped to requirement IDs (e.g. `FR-AUTH-1`) in the requirements doc.

1. Build in phase order — each depends on the previous.
2. Finish a phase to its **acceptance criteria** before starting the next.
3. Treat Section 9 (**Assumed defaults**) as binding unless told otherwise.
4. Where the docs conflict: requirements doc wins on *what*, this doc wins on *how*.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language across UI/API; types generated from the schema |
| Framework | **Next.js (App Router)** | UI + server routes in one project; SSR powers public share pages |
| Styling / UI | **Tailwind CSS + shadcn/ui** | Fast, consistent components |
| Fullscreen viewer | **yet-another-react-lightbox** | Forward/back/close viewer (FR-VIEW-4/5/6/7) |
| **App hosting** | **Fly.io** | Runs the Next.js app as a container near users; persistent Node server |
| **Database** | **Neon** (serverless Postgres) | Your account; standard Postgres, so the schema + RLS carry over |
| **Auth** | **Neon Auth** (Managed Better Auth) | Managed users/sessions in your Neon DB; Next.js SDK; email verify + reset — covers FR-AUTH-* |
| **Photo storage** | **Tigris** (Fly-native, S3-compatible) — default; **Cloudflare R2** as the free-egress alternative | Object storage for images; S3 API means identical code either way |
| Image pipeline | **`sharp`** in the Next.js server | Resize, WebP, thumbnail, EXIF extraction (NFR-OPT) — runs in-process on Fly |
| DB access / migrations | **Drizzle ORM** | Type-safe queries + migrations against Neon |
| Validation | **Zod** | Validate all inputs at the server boundary |
| Email | **Resend** | Verification, reset, share notifications |
| Storage SDK | **`@aws-sdk/client-s3`** | Works unchanged for both Tigris and R2 |

> **Storage decision (Tigris vs R2).** Default to **Tigris** for one-vendor simplicity with Fly (`fly storage create`, endpoint `https://fly.storage.tigris.dev`). Choose **R2** if you want free egress on this read-heavy photo app. Switching between them is one endpoint + credentials change — the pipeline code is identical.

> **Phase 1 prerequisites, verified against Neon's docs during Phase 0:**
> packages are `@neondatabase/auth` (server) + `@neondatabase/auth-ui`, with
> `@neondatabase/neon-js/auth` on the client. It is built on Better Auth 1.4.18,
> runs as a managed REST API, and stores users/sessions in the **`neon_auth`**
> schema of your own database (so `profiles.id` can FK to `neon_auth.user`).
> Constraints that matter here: **AWS regions only** (we are on AWS `us-east-1` ✓)
> and **incompatible with IP Allow / Private Networking** (we use neither).

> ⚠️ **Known SDK defect #2 — `auth.middleware()` blocks every non-GET request.**
> With a valid session cookie, the SDK's middleware redirects ALL non-GET requests
> on a matched path to the login URL:
>
> ```
> GET  /memories -> 200        POST /memories -> 307 /sign-in
> GET  /settings -> 200        POST /settings -> 307 /sign-in
> ```
>
> A Next server action is a POST to the current page's URL, so this silently broke
> **every mutation in the authenticated area** — create/edit/delete memory, set
> cover, delete photo, and both settings forms. Nothing reached application code,
> so there were no logs and no database writes to diagnose from. `proxy.ts` now
> runs the auth middleware for GET/HEAD only; non-GET requests are authorised by
> `requireProfile()` + `lib/access.ts`, which is where the plan (§2, §6) puts the
> real gate anyway. Re-test when the SDK updates.

> ⚠️ **Known SDK defect — `@neondatabase/auth@0.4.2-beta`.** `emailOtp.resetPassword`
> is declared at `email-otp/passcode`, which returns **404**; the working endpoint is
> `email-otp/reset-password`. The 404 surfaces as `code: user_not_found`, which reads
> like a bad verification code and cost real debugging time. `lib/auth/server.ts`
> exports `neonAuthPost` to call the correct path directly — **re-check this and
> remove the workaround when the SDK updates.** An audit of all 65 declared endpoints
> found 9 that 404; the rest (magic-link, JWT, admin, organization, `get-access-token`,
> `revoke-all-sessions`, `verify-email`) are unused by this app.
>
> **Also note:** OTP codes expire in roughly **3 minutes**, and Neon has
> `sendVerificationEmailOnSignUp = false`, so the app must send the verification
> code itself after sign-up (it does).

> **Auth note.** Neon Auth (Managed Better Auth) is in **Beta**. It's the lowest-effort path and keeps auth data in your Neon DB. If you need production-hardened guarantees now, the drop-in alternatives are **self-hosted Better Auth** (same library) or **Clerk** — both also work with Neon and Fly. This plan assumes Neon Auth; swapping to self-hosted Better Auth changes only Phase 1 wiring.

---

## 2. Architecture at a glance

Three flows matter; the rest is CRUD.

**A. Upload (authenticated)**
```
Client → POST /api/photos (multipart, handled by the Next.js server on Fly)
       → Zod validates → sharp: resize + WebP + thumbnail, extract taken_at, strip metadata
       → PUT optimized + thumbnail to Tigris/R2 (S3 client)
       → INSERT photo row (keys, sizes, taken_at) into Neon
       → return metadata
```

**B. View (authenticated)**
```
Server components / route handlers read from Neon, scoped to the Neon Auth user id
Images load DIRECTLY from the Tigris/R2 public URL (CDN)  ← never proxied through the app
```

**C. Public link (guest, no sign-in)**
```
Guest opens /m/[token]  (server component)
  → a PRIVILEGED server-side DB connection looks up the memory
    WHERE public_token = token AND public_link_active = true
  → returns ONLY that memory's data, read-only  → images from Tigris/R2
No auth session is involved; the server route is the gate.
```

**Authorization model (changed from v1).** Because Fly runs a real server and all DB access is server-side, **authorization is enforced in the data/API layer**: every authenticated query is scoped by the Neon Auth user id, and the guest route is the only path without a user and is read-only by construction. Postgres **RLS is available on Neon** and Neon Auth can expose the user id to RLS policies — keep it as optional **defense-in-depth**, but the primary gate is server-side query scoping. (This is a deliberate shift away from the Supabase RLS-first design of v1.)

---

## 3. Project structure

```
memories/
├─ Dockerfile
├─ fly.toml
├─ next.config.js            # output: 'standalone' for small images
├─ app/
│  ├─ (auth)/                # sign-in / sign-up / reset (Neon Auth SDK)
│  ├─ (app)/                 # authenticated area; layout guards the session
│  │  ├─ memories/           # home (FR-MEM-3)
│  │  ├─ memories/[id]/      # detail: grid + viewer
│  │  ├─ shared/             # "Shared with me" (FR-SHARE-3)
│  │  └─ settings/           # profile & settings (FR-PROF-*)
│  ├─ m/[token]/             # PUBLIC guest album (FR-SHARE-8)
│  └─ api/
│     ├─ photos/             # upload + delete
│     └─ memories/           # create/edit/delete, cover, share, revoke-link
├─ lib/
│  ├─ auth.ts                # Neon Auth / Better Auth server + client config
│  ├─ db.ts                  # Neon connection (Drizzle)
│  ├─ storage.ts             # S3 client for Tigris/R2; upload/delete helpers
│  ├─ image.ts               # sharp pipeline
│  └─ validation.ts          # Zod schemas
├─ db/
│  ├─ schema.ts              # Drizzle schema (Section 5)
│  └─ migrations/            # generated SQL migrations
└─ .env.local
```

---

## 4. Environment variables

```
NEXT_PUBLIC_APP_URL=

# Neon database (pooled connection string from the Neon console)
DATABASE_URL=

# Neon Auth (Managed Better Auth) — corrected in Phase 0 against Neon's current
# docs. The previously listed NEON_AUTH_PROJECT_ID / _PUBLISHABLE_KEY /
# _SECRET_KEY belonged to the retired Stack-Auth-based Neon Auth and do not
# exist. Only two variables are needed, and only the first comes from the console
# (Auth → Enable Auth → Configuration):
NEON_AUTH_BASE_URL=          # https://ep-xxx.neonauth.us-east-1.aws.neon.tech/<dbname>/auth
NEON_AUTH_COOKIE_SECRET=     # self-generated, 32+ chars: openssl rand -base64 32

# Object storage (Tigris default; identical shape for R2)
S3_ENDPOINT=https://fly.storage.tigris.dev   # R2: https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_PUBLIC_URL=                               # public/CDN base URL for serving images

# Email
RESEND_API_KEY=
```

All of these become **Fly secrets** in production (Section 11) — never commit them.

---

## 5. Database schema (PostgreSQL, via Drizzle)

> Auth tables (users, sessions, OAuth) are managed by **Neon Auth** in the `neon_auth` schema — do **not** re-create them. `profiles` holds only app-specific user data and links to the Neon Auth user id.

```sql
-- App-specific user data (1:1 with the Neon Auth user)
create table profiles (
  id text primary key,                         -- Neon Auth user id
  display_name text not null,
  image_optimization_enabled boolean not null default true,  -- always true; read-only in UI (FR-PROF-4)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Memories (albums)
create table memories (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references profiles(id) on delete cascade,
  title text not null,
  memory_date date not null,
  cover_source text not null default 'auto' check (cover_source in ('auto','photo','custom')),
  cover_photo_id uuid,                         -- FK added after photos exists
  cover_image_key text,
  cover_thumbnail_key text,
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),  -- FR-SHARE-7
  public_link_active boolean not null default true,                              -- revoke flag (FR-SHARE-10)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Photos
create table photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references memories(id) on delete cascade,
  uploaded_by text not null references profiles(id),
  storage_key text not null,                   -- key for optimized image (Tigris/R2)
  thumbnail_key text not null,                 -- key for thumbnail
  original_filename text,
  mime_type text not null,
  width int, height int,
  optimized_size_bytes bigint,
  original_size_bytes bigint,
  taken_at timestamptz,                        -- from EXIF, extracted before stripping
  sort_order int not null default 0,
  status text not null default 'ready' check (status in ('uploading','ready','failed')),
  created_at timestamptz not null default now()
);
alter table memories
  add constraint fk_cover_photo foreign key (cover_photo_id) references photos(id) on delete set null;

-- Sharing membership  (user_id nullable + invited_email per D13)
create table memory_shares (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references memories(id) on delete cascade,
  user_id text references profiles(id) on delete cascade,   -- null until an email invite is claimed
  invited_email text,                                       -- set for invites to a non-user (D13)
  permission text not null check (permission in ('viewer','contributor')),
  invited_by text not null references profiles(id),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now(),
  constraint memory_shares_target_check check (user_id is not null or invited_email is not null)
);
-- A plain `unique (memory_id, user_id)` no longer works: Postgres treats NULLs as
-- distinct, so every email invite would slip past it. Two partial indexes instead.
create unique index memory_shares_memory_user_uniq
  on memory_shares (memory_id, user_id) where user_id is not null;
create unique index memory_shares_memory_email_uniq
  on memory_shares (memory_id, lower(invited_email)) where invited_email is not null;

-- Social (Phase 4)
create table comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid references photos(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create table likes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  photo_id uuid references photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, photo_id)
);
create table persons (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null references profiles(id) on delete cascade,
  name text not null,
  linked_user_id text references profiles(id)
);
create table photo_tags (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos(id) on delete cascade,
  person_id uuid references persons(id) on delete cascade,
  tagged_by text not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on memories(owner_id);
create index on photos(memory_id);
create index on memory_shares(user_id);
create index on comments(photo_id);
```

> `gen_random_bytes` needs the `pgcrypto` extension: `create extension if not exists pgcrypto;`

---

## 6. Authorization (server-side, with optional RLS)

**Primary gate — data layer.** Every authenticated query is scoped to the current Neon Auth user. Centralize an access helper and use it everywhere:

```ts
// pseudocode
async function assertCanViewMemory(userId: string, memoryId: string) {
  const ok = await db.oneOrNone(`
    select 1 from memories m
    left join memory_shares s
      on s.memory_id = m.id and s.user_id = $1 and s.status = 'accepted'
    where m.id = $2 and (m.owner_id = $1 or s.user_id is not null)
  `, [userId, memoryId]);
  if (!ok) throw new ForbiddenError();
}
```

Editing/contributing/deleting apply the same pattern with permission checks (owner vs. `contributor` vs. own-uploads-only, per FR-SHARE-5 / D10).

**Guest public route.** `/m/[token]` uses a privileged connection with **no user**, selecting strictly by `public_token` + `public_link_active`, returning read-only data.

**Optional defense-in-depth — Postgres RLS.** Enable RLS on the tables and add owner/member policies; Neon Auth can expose the user id to policies. Treat this as a second layer, not the only one, since most access already runs through the scoped server helpers above.

---

## 7. Image pipeline (NFR-OPT)

On upload, in `/api/photos` (Node runtime):
1. Zod-validate file type/size (D6: JPEG/PNG/WebP/HEIC; ~25 MB max).
2. `sharp`: read EXIF, capture `taken_at` **before** stripping metadata.
3. Produce the **optimized** image (longest edge ~2048, WebP q~80) and a **thumbnail** (~400).
4. `PUT` both to Tigris/R2 via the S3 client; store keys + sizes + `taken_at` in Neon.
5. Discard the original (D5).

Serve images from the storage public URL/CDN — never proxy through the app.

---

## 8. Phased build plan

### Phase 0 — Foundation
Scaffold Next.js (+ Tailwind/shadcn); create the Neon project and a dev branch; enable **Neon Auth**; create the **Tigris bucket** (`fly storage create`) or R2 bucket; set up Drizzle and run the first migration; add `Dockerfile` + `fly.toml`; **deploy a hello-world to Fly** to prove the pipeline end to end.
**Acceptance:** app builds and is reachable on its `*.fly.dev` URL; a row round-trips to Neon; a test object round-trips to Tigris/R2 via the public URL.

### Phase 1 — Auth & account (FR-AUTH-*, FR-PROF-*)
Wire the **Neon Auth** SDK: sign-up (email, password rules FR-AUTH-3, display name), sign-in/out, email verification, password reset, and session middleware guarding the `(app)` area. Create a `profiles` row on first sign-in. Settings: update display name (FR-PROF-2), change password (FR-PROF-3), and the **read-only** image-optimization control shown ON/disabled (FR-PROF-4).
**Acceptance:** register → verify email → sign in → reach an empty Memories page → change name/password; unauthenticated users are redirected from `(app)` routes.

### Phase 2 — Memories & photos core (FR-MEM-*, FR-PHOTO-*, FR-VIEW-*)
Memory CRUD + home listing with `Title - (Date)` labels, cover, count, newest-first. Upload pipeline (Section 7) to Tigris/R2. Thumbnail grid with lazy loading; fullscreen viewer with forward/back/close, no wraparound, fit-to-screen. Cover image from a photo or a custom upload (excluded from the grid), with auto/placeholder fallback.
**Acceptance:** create a memory, upload photos (visibly optimized + thumbnailed), browse the grid, page through the viewer, set a cover, delete a photo/memory with its storage objects removed.

### Phase 3 — Sharing & public links (FR-SHARE-*)
Share with another user at `viewer`/`contributor`; "Shared with me"; owner sees members and can revoke; edit/contribute rules enforced in the data layer; share notifications via Resend. Public link: `public_token` exists per row; build `/m/[token]` as a server component using the privileged connection (read-only, guest); owner UI to copy, revoke, regenerate.
**Acceptance:** a second account sees a shared memory under "Shared with me"; a contributor can add photos, a viewer cannot; `/m/[token]` opens read-only when logged out; revoking kills the link immediately.

### Phase 4 — Social (FR-SOC-*)
Comments and likes on photos (D9), manual people-tagging with removal/self-removal usable as an in-memory filter. All gated by the same access helper; guests via public link cannot interact.
**Acceptance:** a member can comment, like, and tag within a shared memory; guests cannot; filtering by a tagged person works.

---

## 9. Assumed defaults (resolving the requirements' open questions)

- **D1 Platform:** responsive **web app** (Next.js). No native mobile.
- **D2 Memory date:** user-set, defaults to today, editable. Memories created **manually**; no EXIF auto-bucketing.
- **D3 Multiple memories per date:** allowed.
- **D4 Email verification:** required before full use.
- **D5 Originals:** **discarded** after optimization (store optimized + thumbnail only).
- **D6 Formats / limits:** JPEG, PNG, WebP, HEIC (convert HEIC → WebP server-side); ~25 MB max per file.
- **D7 Fullscreen wraparound:** stops at first/last.
- **D8 Public link default:** **active from creation**, revocable.
- **D9 Comments/likes target:** **photo-level** for v1.
- **D10 Contributor deletion:** contributors may delete **only their own** uploads.
- **D11 Cover fallback:** if a chosen cover photo is deleted, revert to `auto`.
- **D12 Infrastructure:** **Fly.io** (host) + **Neon** (Postgres + Neon Auth) + **Tigris** (photos; R2 as the free-egress alternative) + **Resend** (email); single Fly region near the users; Drizzle for migrations. *(See Section 1 for the Neon Auth Beta note.)*
- **D13 Invites to non-users:** a memory may be shared with an email address that has **no account yet**. `memory_shares.user_id` is nullable and `invited_email` carries the address until sign-up claims it. Without this, FR-SHARE-1 ("share by email") only works for people who already registered — the wrong default for a family photo app, and a data migration to fix later.
- **D15 Email verification method:** **numeric verification codes**, not links, for v1. Neon Auth's built-in shared sender (`auth@mail.myneon.app`) supports codes; **links require a custom email provider**, which requires a verified domain. Codes let Phase 1 complete with no domain and no Resend dependency. *(Narrows FR-AUTH-8, which says "link" — the guarantee it exists for, proving control of the address, is unchanged. Switch to links in Phase 5 when the domain and branded sender land.)*
- **D16 Auth UI:** auth screens are **hand-built** against the Neon Auth API rather than using `@neondatabase/auth-ui`. The style guide is authoritative on appearance and highly specific (glass panels, ambient orbs, Fredoka wordmark), and the sign-in screen is the product's first impression. Costs Phase 1 time; avoids fighting a third-party component's look.
- **D14 Share acceptance:** sharing with an **existing** user writes `status = 'accepted'` directly; the email is a notification, not a gate (this is what makes Phase 3's "a second account sees it under Shared with me" true). Only **D13 email invites** start `pending`, flipping to `accepted` when the address is claimed at sign-up. The access helper grants on `'accepted'` alone. *(Resolves the gap where nothing ever left the schema's `'pending'` default.)*

---

## 10. Security checklist (must-pass before launch)

- [ ] Every authenticated DB access goes through the scoped access helper (owner / member / non-member tested).
- [ ] Guest route (`/m/[token]`) uses a privileged connection **server-side only** and returns read-only data; no privileged credentials reach the browser.
- [ ] All request bodies validated with Zod at the server boundary.
- [ ] `public_token` is high-entropy and unguessable; revoke sets `public_link_active = false` and takes effect immediately.
- [ ] Images served from the Tigris/R2 CDN, not proxied through the app.
- [ ] Passwords, verification, reset, lockout handled by Neon Auth (not custom code).
- [ ] HTTPS enforced (Fly TLS + custom domain); all secrets set via `fly secrets`, none in the repo.
- [ ] Deleting a memory/photo removes the corresponding storage objects (no orphans).
- [ ] Optional: RLS enabled on all tables as defense-in-depth.

---

## 11. Deployment — preferred: Fly.io + Neon + Tigris

Step-by-step runbook. Run once to set up, then `fly deploy` for every release.

### 11.1 Prerequisites
- Install the Fly CLI (`flyctl`) and sign in: `fly auth login`.
- Have your Neon project ready (or create one): `neonctl` optional.
- Node 20+ locally.

### 11.2 Neon (database + auth)
1. In the Neon console, create the project; copy the **pooled** connection string → `DATABASE_URL`.
2. Enable **Neon Auth** (console → Auth); copy the project id + keys into the auth env vars.
3. `create extension if not exists pgcrypto;` then run Drizzle migrations (see 11.6).

### 11.3 Object storage (Tigris)
1. Create a bucket: `fly storage create` (this provisions Tigris and returns S3 credentials + the `https://fly.storage.tigris.dev` endpoint).
2. Set `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION=auto`, and a public `S3_PUBLIC_URL` for serving images.
   - *R2 alternative:* create an R2 bucket + S3 API token, set the same variables with R2's endpoint and a public custom domain.

### 11.4 App container
`next.config.js`:
```js
module.exports = { output: 'standalone' };
```
`Dockerfile` (multi-stage, standalone output):
```dockerfile
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```
> `sharp` ships prebuilt binaries for linux; on the slim image install `libvips` if a build step requires it (`apt-get install -y libvips`).

> ⚠️ **HEIC does not work on stock `sharp`** — verified in Phase 0. The bundled
> libvips reports `heif` input support for **AVIF only** (`fileSuffix: ['.avif']`);
> HEVC-encoded HEIC is excluded for patent/licensing reasons. D6 requires
> HEIC → WebP, so Phase 2 must pick one: build libvips with libheif in the
> Dockerfile (bigger image, slower builds), add a JS fallback such as
> `heic-convert` for the HEIC minority (slow, memory-hungry), or amend D6 to drop
> HEIC. This is the default iPhone camera format — decide deliberately.

### 11.5 fly.toml
```toml
app = "memories"
primary_region = "iad"   # Ashburn, VA — users are in New York; Neon project in AWS us-east-1

[build]

[deploy]
  release_command = "npm run db:migrate"   # runs migrations before each release

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "1gb"
```

> **Deviations applied in Phase 0** (the committed `fly.toml` and `Dockerfile` are authoritative):
> - **1 GB, not 512 MB.** `sharp` decoding a 25 MB / 50 MP upload (D6) needs headroom; an OOM kill mid-upload is the worst possible first impression.
> - **`node:24-slim`, not `node:20`.** Matches the local toolchain, so the image pipeline can't drift from development.
> - **`release_command = "node dist/migrate.mjs"`, not `npm run db:migrate`.** With `output: 'standalone'` Next traces only what the *app* imports, so neither `tsx` nor Drizzle's migrator exists in the runtime image and the documented command fails on first deploy. `scripts/bundle-migrate.mjs` bundles the migrator at build time instead.
> - **`pg` (node-postgres) rather than Neon's HTTP driver.** Fly runs a long-lived server, so a warm TCP pool beats one HTTP round trip per query.

### 11.6 Secrets & migrations
```bash
fly launch --no-deploy          # generates the app; keep the fly.toml above

fly secrets set \
  DATABASE_URL="..." \
  NEON_AUTH_BASE_URL="..." NEON_AUTH_COOKIE_SECRET="..." \
  S3_ENDPOINT="https://fly.storage.tigris.dev" S3_REGION="auto" \
  S3_ACCESS_KEY_ID="..." S3_SECRET_ACCESS_KEY="..." S3_BUCKET="..." S3_PUBLIC_URL="..." \
  RESEND_API_KEY="..." NEXT_PUBLIC_APP_URL="https://memories.fly.dev"
```
Migrations run automatically via the `release_command`; to run manually: `fly ssh console -C "npm run db:migrate"`.

### 11.7 Deploy
```bash
fly deploy
```
Verify: `fly logs`, open the `*.fly.dev` URL, register a test user, upload a photo, open a public link.

### 11.8 Custom domain + TLS
```bash
fly certs add app.yourdomain.com   # then add the shown DNS records at your registrar
```
Then update `NEXT_PUBLIC_APP_URL` and Neon Auth's **trusted domains / redirect URLs** to the custom domain.

### 11.9 Scaling & operations
- Region/scale: `fly scale count 1` (bump when needed); keep `min_machines_running = 1` so sessions and image caching are warm.
- Backups/branching: use Neon branches for staging/preview and Neon's point-in-time restore.
- Monitoring: `fly logs`, Fly metrics, and Neon's dashboard for DB load.
- CI/CD (optional): a GitHub Action that runs `flyctl deploy` on push to `main`, using a `FLY_API_TOKEN` secret.

---

## 12. Out of scope (do not build)

Per the requirements doc: face detection/recognition; timeline/map/search views; native mobile; user-configurable image optimization; video. Keep the schema and UI free of hooks for these so the build stays lean.

---

*End of implementation plan.*
