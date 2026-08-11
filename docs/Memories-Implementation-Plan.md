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
| Video pipeline | **none — the browser, then straight to storage** | D23: no transcoder. The uploader's browser produces the poster frame (`FR-VIDEO-3`) and the file is stored as uploaded. Deliberately avoids putting ffmpeg on a shared 1 GB machine, and avoids a transcoding vendor |
| Archive building | **`client-zip`** in the browser | D24: assembles download `.zip`s client-side (`FR-DL-5`), so image bytes are never proxied through the app. ~3 KB, no dependencies, store-only — which is right for already-compressed WebP/MP4 |
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
├─ version.config.json       # version baseline only (§7d, D28)
├─ .github/workflows/
│  └─ deploy.yml             # the only deploy path: push to main (§11.7)
├─ scripts/
│  └─ compute-version.mjs    # derives the version from git history (FR-VER-1)
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

## 4a. Local development environment (added 10 August 2026)

Until this date `.env.local` held **production** values for everything except `NEXT_PUBLIC_APP_URL`: `next dev` read and wrote the live database and uploaded into the live bucket. Development now has its own of both.

| | Development | Production |
|---|---|---|
| Neon branch | `dev` (endpoint `ep-wispy-silence-aw8ewn9p`) | default branch |
| Neon Auth | the `dev` branch's own auth environment | the default branch's |
| Tigris bucket | `berco-memories-photos-dev` | `berco-memories-photos` |

**Split both, or neither.** A dev database pointed at the production bucket is *worse* than sharing both: deleting a test photo locally would destroy an object the live app still has a row for, and production would start serving broken images. The two halves move together.

**Neon Auth is branch-aware** — each branch gets an isolated auth environment, and users and sessions are copied when the branch is created, so an existing account can sign in on `dev` with its existing password. The branch's `NEON_AUTH_BASE_URL` is the production one with the endpoint id swapped and `-pooler` dropped; confirm it in Auth → Configuration with the branch selected.

⚠️ **Console-created Neon branches default to a 1-day expiration**, after which the branch and its auth environment are **permanently deleted**. Branches created via the API or CLI have none. After creating a dev branch in the console: Branches → the branch → Actions → Edit expiration → toggle off *"Automatically delete branch after"*.

⚠️ **`fly storage create` has no `--no-attach` flag.** Run inside this repo it reads `fly.toml`, attaches the new bucket to `berco-memories`, and **overwrites the production `AWS_*` / `BUCKET_NAME` secrets** — pointing the live app at an empty bucket. Create dev buckets from a directory with no `fly.toml`, naming the org explicitly:

```bash
fly storage create -o personal -n berco-memories-photos-dev -p -y   # -p = public, or every thumbnail 404s
```

A branch copies the `photos` rows, whose keys point into the *production* bucket, so pre-existing media 404s in development. Delete the copied memories on the branch and create test data rather than mirroring objects.

---

## 5. Database schema (PostgreSQL, via Drizzle)

> Auth tables (users, sessions, OAuth) are managed by **Neon Auth** in the `neon_auth` schema — do **not** re-create them. `profiles` holds only app-specific user data and links to the Neon Auth user id.

```sql
-- App-specific user data (1:1 with the Neon Auth user)
create table profiles (
  id text primary key,                         -- Neon Auth user id
  display_name text not null,
  image_optimization_enabled boolean not null default true,  -- always true; read-only in UI (FR-PROF-4)
  -- FR-QUOTA-1 / D26: per-user so a future paid tier (FF-BILLING) is an UPDATE,
  -- not a migration. 20 GB = 21474836480 bytes.
  storage_quota_bytes bigint not null default 21474836480,
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
  -- D23: photos and videos share this table; only decode/playback differ
  media_type text not null default 'image' check (media_type in ('image','video')),
  storage_key text not null,                   -- optimized image, or the video file as uploaded
  thumbnail_key text not null,                 -- thumbnail, or the video's poster frame
  original_filename text,
  mime_type text not null,                     -- image/webp, video/mp4, video/webm
  width int, height int,
  optimized_size_bytes bigint,                 -- the video file itself when media_type = 'video'
  thumbnail_size_bytes bigint,                 -- FR-QUOTA-3: thumbnail/poster; without it usage undercounts ~13%
  original_size_bytes bigint,                  -- NOT counted against quota; the original is discarded (D5)
  duration_seconds int,                        -- FR-VIDEO-5; null for images
  taken_at timestamptz,                        -- from EXIF, extracted before stripping; null for video
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

## 7a. Video pipeline (FR-VIDEO-*, D23)

There isn't one, server-side, and that is the design. `sharp` cannot decode video, and the two ways to get a real pipeline — ffmpeg in-process on the single Fly machine, or a transcoding vendor — cost either request-serving capacity or a new vendor and cost line. D23 takes neither.

In `/api/photos`, the same route as photos:

1. **Sniff the bytes** (`lib/video.ts`) — WebM's EBML magic, or an ISO-BMFF `ftyp` box with a web-playable MP4 brand. The client's `file.type` is not trusted. HEIC/HEIF brands share the `ftyp` box and are deliberately excluded, so an iPhone still photo is never mistaken for a video.
2. **Charge a guest's video to a second rate-limit budget** (`FR-VIDEO-7`, D25) — 5 per 15 minutes, on top of D21's general 12 per 10 minutes. Guests may upload video; they just cannot do it at the volume the photo limit would have allowed.
3. **Require the poster frame** the client captured (`lib/video-capture.ts`): the browser decodes the file, seeks ~1s in, draws to a canvas, and sends the frame as JPEG. **No poster means no upload** — a file this browser can't decode is one it couldn't have played.
4. **Run the poster through `sharp`** (`processPoster`) for the ~400px WebP thumbnail. Its pixel dimensions *are* the video's, so width/height come from here rather than from a client-asserted number.
5. **`PUT` the video unmodified** plus the poster; store `media_type='video'`, the mime type, and the Zod-bounded `duration_seconds`.

Consequences to keep in mind, all stated in the requirements rather than left implicit:

- **The stored file IS the original.** D5's "discard the original" is an image-only rule; NFR-OPT likewise.
- **Video metadata is not stripped** (`FR-VIDEO-6`), unlike EXIF on photos. The user is told.
- **`taken_at` is null for video.** Container creation times are absent or zeroed too often to beat the upload-time fallback in FR-PHOTO-7.
- The 100 MB cap is load-bearing, not cosmetic: the route buffers the whole body, on a 1 GB machine, at upload concurrency 2.

---

## 7b. Download pipeline (FR-DL-*, D24)

Also not on the server. `lib/download.ts` runs in the browser:

1. It is handed the `MemoryPhoto[]` the page already rendered — **never an id, never a fetch to our API**. Whatever the scoped access helper (or `getPublicMemory`) authorised is exactly what can be downloaded, so this adds no access path to review.
2. Size and count ceilings are checked **before** anything is fetched (`FR-DL-7`).
3. Each asset is fetched from its CDN URL, sequentially, so progress means something and a 300-file memory doesn't fire 300 parallel requests.
4. `client-zip` streams the entries into an archive; the blob is handed to an `<a download>`.

**The deployment step this creates:** `<img>` can load a cross-origin file without permission; `fetch` cannot. The bucket needs a CORS rule or downloads fail while everything else works — a confusing failure to diagnose after the fact. Run once per bucket, and again whenever an origin changes:

```bash
npm run storage:cors -- https://memories.ghenadie-berco.com
```

⚠️ **The script targets whichever bucket `.env.local` names, and `PutBucketCors` replaces the rule set rather than appending to it.** Since 10 August 2026 development has its own bucket (`berco-memories-photos-dev`, see §4a), so running it bare from a dev machine is correct — it authorises `localhost` on the dev bucket and leaves production's rules alone. **To touch the production bucket you must be pointed at it and must name the production origin**, because the default `NEXT_PUBLIC_APP_URL` would otherwise replace production's rule set with `localhost` and silently break every download.

It grants `GET`/`HEAD` and nothing else. It does not widen access: the objects are already world-readable by URL, which is how the CDN serves them at all (NFR-PRIV §5.5). See `scripts/set-bucket-cors.ts`.

---

## 7c. Storage quota accounting (FR-QUOTA-*, D26)

`lib/storage-quota.ts` owns this. Two functions and one rule.

**The rule: usage is derived, never counted.** There is no `bytes_used` column. Usage is a `SUM` over the media in the memories a user owns:

```sql
select coalesce(sum(coalesce(p.optimized_size_bytes, 0)
                  + coalesce(p.thumbnail_size_bytes, 0)), 0)
from photos p
join memories m on m.id = p.memory_id
where m.owner_id = $1 and p.status = 'ready';
```

A maintained counter would be a second source of truth, and every path that deletes media — photo delete, bulk delete, memory delete, a failed upload's cleanup, a manual fix in `psql` — would have to remember to decrement it. One of them eventually won't. The `SUM` is index-backed on `photos(memory_id)` and runs on data sized in the low thousands of rows per user; if it ever becomes slow the fix is a materialized view, not a counter.

Three details that are easy to get wrong:

- **`join memories` is what makes it owner-charged.** Summing `where p.uploaded_by = $1` would be the uploader-charged reading, and it silently omits every guest upload, since those have `uploaded_by = NULL` (D21). That is the exact hole the quota exists to close — see D26.
- **Add `thumbnail_size_bytes`, don't infer it.** `optimized_size_bytes` holds only the full-size asset. Measured on live data the full-size average is 198 KB against a 13 KB thumbnail, so summing the one column alone undercounts by **~6.6%** — an item really costs ~211 KB, not 198.
- **`status = 'ready'` only.** A row that is still `uploading` or has `failed` has no settled bytes to charge for.

**Enforcement — `assertQuota(ownerId, incomingBytes)`** runs in the upload route *before* the S3 `PUT`, on both the authenticated and the guest path (`FR-QUOTA-5`). It throws a typed error the route turns into a 413 with the remaining space named (`FR-QUOTA-4`), or a guest-safe message that discloses no figures (`FR-QUOTA-6`).

> ⚠️ **The check is inherently racy and that is accepted.** Two concurrent uploads can both read usage below the line and both pass. The overshoot is bounded by one file (25 MB, or 100 MB for video) against a 20 GB quota, and the alternative — a transaction that locks the owner's whole photo set for the duration of an upload — costs far more than the ~0.5% it would recover. Do not "fix" this with a lock.

**Known gap, currently latent: custom memory covers are not counted.** `memories.cover_image_key` / `cover_thumbnail_key` (FR-MEM-10) would be real stored objects with no size columns, so they fall outside the `SUM`. **Today this costs nothing — custom cover *upload* was never built** (see Current-Features "Known gaps"), so no such object exists. It becomes a real undercount the moment that gap is closed, bounded by one cover per memory at ~211 KB. **Whoever builds cover upload owns this:** add the size columns in the same change, or the quota starts lying the day the feature ships.

---

## 7d. App version derivation (FR-VER-*, D28)

The version is **computed, never stored**. Three moving parts:

| Piece | Role |
|---|---|
| `version.config.json` | Holds `base` only. The commit that last **changed** this file is the baseline, and that commit *is* `base`. Editing it declares a new floor — the manual override for a major release. |
| `scripts/compute-version.mjs` | Replays every commit since the baseline and prints the version. `npm run version:print`. |
| `.github/workflows/deploy.yml` | Runs the script and passes the result to `flyctl deploy --build-arg APP_VERSION=…`. |

**Replay rules,** oldest commit first (`FR-VER-3`):

```
feat:                       -> minor++, patch = 0
`!` marker / BREAKING CHANGE: -> major++, minor = patch = 0
anything else (incl. no prefix) -> patch++
merge commits               -> skipped
```

**Reaching the browser.** `.git` is dockerignored, so the image cannot derive its own version. CI computes it and passes it as a build arg; the Dockerfile turns that into `NEXT_PUBLIC_APP_VERSION`, which `next.config.ts` pins into `env` so Next inlines it at build time. `components/app-footer.tsx` reads it as a server component — no client JavaScript, nothing to fetch at runtime. Locally, `next.config.ts` falls back to running the script directly, so `npm run dev` shows a real number.

> **In development the footer goes stale the moment you commit.** The version is resolved once, at config load, and inlined for the life of the process — so a `next dev` server started before a commit keeps serving the older number and local will disagree with production. This is the build-time guarantee (`FR-VER-4`) behaving as specified, not a defect: restart the dev server to refresh, and treat `npm run version:print` as the authority. Resist "fixing" it by resolving the version per request — that buys freshness on a number that only matters in production, at the cost of a subprocess and a `git log` on every page render.

> ⚠️ **Two failure modes worth knowing before you touch this.** The replay is **`--topo-order`, not date order** — commits sharing a second can sort arbitrarily, and a merged branch's `feat:` landing ahead of a `BREAKING CHANGE:` would have its minor bump wiped by the major reset, so the same history would yield two different versions. And a **shallow clone hard-fails by design**: truncated history resolves the baseline to the grafted tip and returns a stale, entirely plausible number. Keep `fetch-depth: 0`.

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

> **Phase 4 is empty by decision (D20).** The phases below were added after the phased plan was written, at the owner's request, and are numbered to say so.

### Phase 5 — Owner-requested additions (post-plan)
Guest photo contributions (D21), multi-select bulk delete, and the admin console with global maintenance mode (D22).
**Acceptance:** confirmed working by the owner.

### Phase 6 — Download, video, and the enlarged viewer (FR-DL-*, FR-VIDEO-*, FR-VIEW-8/9)
The first three deferred `FF-*` items, promoted and specified on 10 August 2026. Download assembled in the browser with size ceilings, guests included (Section 7b, D24). Video stored as uploaded with a browser-captured poster, open to guests on a tighter rate-limit budget (Section 7a, D23 + D25). Viewer enlarged to the available viewport, plus zoom, pan, pinch and a Fit control for images — video plays instead, with its own controls.
**Acceptance:** upload an MP4 and see it marked and playable in the grid and viewer; zoom and pan a photo, then Fit; download one item, a selection, and a whole memory as a correctly-named `.zip`; do the same as a guest on a public link; confirm a guest **cannot** upload video. **Requires `npm run storage:cors` to have been run against the bucket** — downloads fail without it while everything else works.

### Phase 7 — Storage quota (FR-QUOTA-*, D26)
Owner-requested, specified 10 August 2026. A **20 GB per-user quota** charged to the **memory owner**, enforced server-side on every media write, and surfaced as a **Storage Used vs Total meter in the top bar** on all authenticated pages.

Build order, because each step depends on the one before:

1. **Schema.** Add `profiles.storage_quota_bytes` (bigint, default 20 GB — per-user so `FF-BILLING` never needs a migration) and `photos.thumbnail_size_bytes` (bigint, nullable). Generate and run the Drizzle migration.
2. **Backfill `thumbnail_size_bytes`** for existing rows. They were written before the column existed, so they contribute their full-size bytes and nothing else until backfilled — an undercount, not a wrong number, which is why the column is nullable and the `SUM` coalesces. `scripts/backfill-thumbnail-sizes.ts` `HEAD`s each thumbnail object and writes its `ContentLength`.
3. **`lib/storage-quota.ts`** — the derived-usage query and `assertQuota` (Section 7c).
4. **Record thumbnail size on new uploads** in `app/api/photos/route.ts`, both media paths. Do this *before* wiring enforcement, or the first uploads under the new rule are themselves undercounted.
5. **Enforce** in the upload route ahead of the S3 `PUT`, on the authenticated *and* guest paths, with the two distinct messages (`FR-QUOTA-4` / `FR-QUOTA-6`).
6. **The meter** — a server-rendered component in `TopBar`, with near-full (≥ 80%) and full (≥ 100%) states per `FR-QUOTA-8`, collapsing to a bar without figures on narrow screens.

**Acceptance:** the top bar shows a correct used/total figure that matches a hand-run `SUM` against the database; uploading is refused with a message naming the remaining space once the quota would be exceeded, and refused on the guest path too **without disclosing the owner's figures**; deleting media lowers the figure immediately; a user over quota can still view, share, download, and delete; lowering one user's `storage_quota_bytes` in the database changes only that user's meter.

### Phase 8 — Landing page (FR-LAND-*, D27)
Owner-requested, specified 10 August 2026. The app's front door: `/` shows a marketing page to anyone without a session, with a coverflow carousel of the ten most substantial features and a "Create memories" call to action.

1. **`lib/landing-features.ts`** — the ten cards as static data, ordered by magnitude per `FR-LAND-5` (20 GB storage first). No database import, ever.
2. **`components/landing/feature-carousel.tsx`** — a client component: auto-advance, pause on hover/focus, arrows, dots, arrow-key support, and the `prefers-reduced-motion` branch.
3. **`app/page.tsx`** — the root becomes the landing page for signed-out visitors and keeps redirecting signed-in ones to `/memories`.
4. **`app/m/[token]/page.tsx`** — repoint the guest wordmark from `/sign-in` to `/` (`FR-LAND-3`).

> ⚠️ **The one that will bite you: Lucide icons cannot be passed from a server component to a client component.** They are React component *functions*, and functions don't cross that boundary. Passing `LANDING_FEATURES` as a prop **typechecks and builds cleanly**, then throws `Functions cannot be passed directly to Client Components` on the first request. The carousel therefore imports the feature list itself rather than receiving it. This cost a 500 on the first run — `npm run build` will not catch it, only loading the page will.

**Acceptance:** signed out, `/` shows the landing page; signed in, `/` still lands on Memories without a flash of marketing; the carousel advances on its own, stops while hovered or focused, and is fully drivable by arrows, dots, and the keyboard; with `prefers-reduced-motion` it does not auto-advance and does not animate, but still works by hand; the page is legible at 390px wide; the wordmark on a public album leads to the landing page.

### Phase 9 — Versioning & automated deploys (FR-VER-*, D28)
Owner-requested, specified 11 August 2026. Gives the app a version that moves on every commit and moves deployment off the laptop and into CI. See §7d for the mechanism.

1. **`version.config.json`** — the baseline, `1.0.0`. Its own commit is that version.
2. **`scripts/compute-version.mjs`** — the replay, wired up as `npm run version:print`.
3. **`Dockerfile` + `next.config.ts`** — `ARG APP_VERSION` → `NEXT_PUBLIC_APP_VERSION`, inlined at build; git fallback for local development.
4. **`components/app-footer.tsx`** in the root layout — every page, every visitor (`FR-VER-2`).
5. **`.github/workflows/deploy.yml`** — lint + typecheck, then derive and deploy.

> ⚠️ **`fetch-depth: 0` is load-bearing.** Without the full history the baseline lookup lands on the grafted tip and returns a stale version that looks completely reasonable. The script refuses to run on a shallow clone for exactly this reason — if you ever see it fail that way, the checkout is what to fix, not the script.

**Acceptance:** `npm run version:print` prints `1.0.0` at the baseline commit and moves per `FR-VER-3` thereafter; the footer shows the same number on the landing page, an auth screen, an album, and a public `/m/[token]` link; a push to `main` deploys with the derived version in the Actions summary; a build with no `APP_VERSION` reports `0.0.0-dev`.

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
- **D17 HEIC:** accepted via a **JS fallback** (`heic-convert` → JPEG → sharp). Verified in Phase 0 that stock `sharp` decodes AVIF but not HEIC. Slower and more memory-hungry than a native libvips build, which is part of why the VM is 1 GB.
- **D18 Fullscreen viewer:** **hand-built**, not `yet-another-react-lightbox` (plan §1). FR-VIEW-3..7 needs only prev/next/close with no wraparound, and the style guide §6 specifies the look precisely. Keyboard (arrows/Esc) and neighbour preloading are implemented directly. Same reasoning as D16.
- **D19 Photo display order:** `coalesce(taken_at, created_at)` **ascending**, resolving FR-PHOTO-7 (left "to confirm"). Capture time means a day's photos read in the order they were taken rather than the order they happened to upload; upload time is the fallback when a photo carries no EXIF.
- **D20 Social features: ALL OUT of v1.** Descoped by the product owner — comments and likes first, then people tagging. **Nothing from requirements Section 3.7 (FR-SOC-1..5) ships in v1**, so Phase 4 is empty and the delivered product is Phases 0–3. People tagging was built and then removed at the owner's request; the removal took out `lib/people.ts`, the tag actions and UI, the tag filter, the viewer's footer slot, and `assertCanViewPhoto`. The `comments`, `likes`, `persons`, and `photo_tags` tables **remain in the schema, unused** — dropping them needs a migration for no benefit, and they are the natural home if any of this returns.
- **D21 Guest contributions:** a memory owner may switch on **"Let anyone with the link add photos and videos"** (photos only until D25), letting guests upload through the public link without an account. **Amends FR-SHARE-9**, which previously made guest access strictly read-only. Design: `memories.public_can_contribute` (off by default, per memory, owner-only); `photos.uploaded_by` becomes nullable, and NULL means a guest upload — so D10's "contributors delete their own uploads" cannot apply and only the owner can delete one. Authorised solely by `getPublicMemoryForContribution()`, which requires token + `public_link_active` + `public_can_contribute`, so revoking the link also stops uploads. Rate-limited per IP (`lib/rate-limit.ts`, in-process — see its header for the honest limits of that). **Open risks: no content moderation, and the rate limit doesn't survive a second machine.**
- **D22 Admin console + maintenance mode:** amends requirements §2, which said "v1 has no admin role" and reserved `role` for the future. Adds `profiles.role` (`user`/`admin`), `profiles.deactivated_at`, and a single-row `app_settings` table.
  - **Role lives in `profiles`, not Neon Auth.** Authorization must not depend on a beta SDK whose admin endpoints were found returning 404.
  - **Deactivation** is enforced in `requireProfile()` on every authenticated request — the Neon Auth session may still be valid, so the application layer is what actually locks the account out. Memories and photos are left untouched. An admin cannot deactivate themselves.
  - **Maintenance mode** blocks every mutation (`assertWritable` in all actions and both upload paths) and shows a banner on authenticated *and* public pages. Reads keep working. **Admins are exempt**, or turning it on would remove the ability to turn it off. It reads from the database, not an env var, so it can be flipped without a redeploy — a redeploy being exactly what you can't rely on when you need to freeze the app. `isMaintenanceMode()` **fails open**: a database hiccup must not lock everyone out.
  - **Granting admin** is a manual SQL step, deliberately — there is no UI to promote someone:
    ```sql
    update profiles set role='admin'
    where id = (select id::text from neon_auth."user" where lower(email)=lower('someone@example.com'));
    ```
  - ⚠️ **Cross-schema joins need a cast.** `neon_auth.user.id` is `uuid`; `profiles.id` is `text`. Postgres has no implicit `uuid = text`, so every join needs `u.id::text` — this broke the admin console's user list on first run.
- **D14 Share acceptance:** sharing with an **existing** user writes `status = 'accepted'` directly; the email is a notification, not a gate (this is what makes Phase 3's "a second account sees it under Shared with me" true). Only **D13 email invites** start `pending`, flipping to `accepted` when the address is claimed at sign-up. The access helper grants on `'accepted'` alone. *(Resolves the gap where nothing ever left the schema's `'pending'` default.)*
- **D23 Video: stored as uploaded, not transcoded.** Resolves the fork the deferred `FF-VIDEO` item said had to be settled before any code. Rejected: **ffmpeg on the Fly machine** (competes with request serving on one shared 1 GB VM, blows the route's time budget, and realistically needs a job queue and a "processing" tile state) and an **external transcoder** (best output, but a new vendor, a monthly cost line, secrets, and a webhook path). Chosen instead: accept only what a browser already plays — **MP4 and WebM** — cap hard at **100 MB** (separate from D6's 25 MB photo cap), and take the poster frame from the uploader's browser (`FR-VIDEO-3`), which doubles as proof the file is playable. Consequences, all made explicit rather than left to be discovered: **D5 does not apply to video** — there is no derived copy, so the stored file *is* the original; **video metadata is not stripped** the way EXIF is, and `FR-VIDEO-6` says so to the user; **`taken_at` is null**, so video sorts by upload time. ~~Guests cannot upload video.~~ **Superseded the same day by D25 — see below.** **Open risks: no server-side content validation beyond container sniffing, and no way to shrink a video a user uploads at full phone resolution.**
- **D25 Guests may upload video too.** Reverses the guest restriction D23 shipped with, at the owner's direction: **guest contribution means "add whatever the app supports"**, and a guest invited to contribute to a memory is contributing to it — the media type was never the interesting distinction. The build's caution was not the owner's rule, and the share dialog's own label made the mismatch obvious. What survives the reversal is the *cost* concern behind it: D21's single per-IP limit (12 per 10 minutes) was sized when every upload was capped at 25 MB, and at 100 MB per video that window would let one anonymous IP push over a gigabyte into paid storage. So video now spends a **second budget of its own — 5 per 15 minutes — charged on top of the general one, and only to guests**; a signed-in contributor was vouched for by the owner and is not the abuse case. Also corrected the member-facing labels: "Can add photos" became "Can add photos and videos", since a contributor was never restricted to photos and the shorter label understated the permission being granted.
- **D24 Download: assembled in the browser, and guests may download.** Two decisions the deferred `FF-DL` item flagged. **(a) Where the zip is built:** in the browser, from the CDN URLs the page already holds (`FR-DL-5`), rather than streamed from a server route — which would have moved image bytes through the app and needed an explicit carve-out from a stated non-negotiable. This also means download introduces **no new server route and no new access path**: it can only reach what was already rendered to that viewer. **(b) Guest access:** guests on a public link **can** download, at the owner's decision, amending `FR-SHARE-9`. The deferred item recommended off-by-default with a per-memory opt-in; the owner chose always-on, which needs no schema column and keeps the public page's controls the same as the owner's. It stays a read that reaches no further than the page itself, and revoking the link ends both together. **Costs: the bucket now needs a CORS rule (`npm run storage:cors`) or downloads fail silently while everything else works**, and the archive is assembled in memory, hence the 300-item / ~500 MB ceilings in `FR-DL-7`.
- **D26 Storage quota: 20 GB per user, charged to the memory owner.** Answers the requirements' open question 5, which had been carrying "is there a per-user photo limit?" unresolved since v1. **20 GB** at the owner's direction; Tigris Standard is $0.02/GB/month with free egress, so the ceiling costs **$0.40 per user per month if actually filled**, and about **$47/year** if ten users all fill it. That is the number the limit is buying down — realistic photo-only use at this scale sits inside Tigris's free 5 GB.
  - **Charged to the owner, not the uploader.** The alternative reading — each user's own uploads count against their own quota — was rejected because it leaves **guest uploads uncapped**: they have `uploaded_by = NULL` (D21), so there is no user to charge, and the one path where an anonymous link holder spends the owner's money would be the one path with no ceiling. Owner-charged also matches how the bill actually arrives: Tigris invoices for bytes in the bucket, and the owner is who chose to enable the link. The cost is that a busy contributor can consume the owner's allowance — visible in the owner's meter, and the owner already controls the sharing that caused it.
  - **A limit, not a metering system.** No `bytes_used` counter, no usage history, no per-memory sub-limits, no admin-facing usage report. Usage is a `SUM` derived on read (Section 7c) because a counter would need every delete path to remember it. Held **per user** in `profiles` rather than as an app constant, so `FF-BILLING` can raise one account's allowance with an `UPDATE`.
  - **Consequences made explicit:** the check is **racy** by design (bounded by one file's overshoot — see the warning in Section 7c); **custom memory covers are not counted**, a bounded undercount recorded there as a known gap; and the quota blocks **uploading only** — a user over quota keeps full read, share, download, and delete access (`FR-QUOTA-10`), because a quota is never a reason to withhold someone's own memories.
  - **The subtle one:** `optimized_size_bytes` never included the thumbnail, so any quota built on that column alone silently undercounts every image by ~6.6% (measured after the backfill: 198 KB full-size against a 13 KB thumbnail). Hence `thumbnail_size_bytes` and its backfill.

- **D27 Landing page: at the root, selling to strangers.** Three choices the request left open.
  - **(a) Where it lives: `/`.** Rejected `/getting-started` and `/welcome`, which both leave a visitor who types the bare domain staring at a login form — the weakest possible first impression, and it denies the marketing page the canonical URL for search and link previews. The root was already a session-branching router, so this is a change of one branch, not new routing. Signed-in users are unaffected: they still fall straight through to `/memories` (`FR-AUTH-10`).
  - **(b) What the button does: sign-**up**, not sign-in.** The request said the "Create Memories" button should lead to sign-in. It now leads to **sign-up**, at the owner's decision after the mismatch was raised: a landing page exists to convert people who do *not* have an account, and the button's own words promise creating something. Returning users get a quieter "Already have an account? Sign in" beneath it, so nobody is stranded.
  - **(c) Carousel style: coverflow.** Rejected an orbiting ring (most literally 3D, but text on the angled cards is hard to read and it is fussy on a phone) and a depth stack (calm, but barely reads as 3D). Coverflow keeps the centre card square to the viewer and fully legible, which matters because these cards *are* the argument for signing up.
  - **The style guide's glass recipe is deliberately overridden on the centre card.** §4's `rgba(255,255,255,0.55)` assumes glass over ambient light; in a coverflow the cards overlap *each other*, and at 55% the card behind renders straight through the one in front — two features' text superimposed, which is what the first build did. The active card sits at 0.9 opacity and neighbours keep the translucency, becoming the "colourful light behind" themselves. Neighbours also blur by distance, which reads as depth and stops their copy competing with the centre card's.
  - **The page reads no user data at all** (`FR-LAND-10`), which is the cheapest possible answer to "is the new unauthenticated route safe?" — it has no facts about anybody to leak. Keep it that way: the temptation later will be a live photo count or a real example album, and either one drags this page into the access model.

- **D28 Versioning: derived from git history, and CI is the only way to deploy.** Four choices the owner settled on 11 August 2026 (`FR-VER-*`).
  - **(a) SemVer, driven by conventional commits.** Rejected CalVer (`2026.08.3`), which is arguably the more honest format for a continuously-deployed app with no downstream consumers and no compatibility contract to signal — but the history already carries `feat:`/`fix:` prefixes, and the owner chose the familiar triple knowing the trade. Be clear-eyed about what the number means here: strict SemVer versions *releases*, not commits, so with a commit-level bump the minor digit counts **features shipped** rather than marking a release boundary. It will climb quickly.
  - **(b) Derived, never stored.** The version is a pure function of the repository — nothing writes it back to `package.json`. This was not only a tidiness choice: a bot commit that records the version **is itself a commit**, so it changes the very history the version is computed from. The two mechanisms would chase each other. Deriving instead removes the bump commit, the workflow's write access to `main`, and the possibility of the number disagreeing with the code it labels. **`package.json`'s own `version` field is deliberately left untouched and unused** — the package is `private`, so it is inert, and mirroring the baseline into a second place is exactly the drift this decision exists to avoid.
  - **(c) The baseline is the commit that last *changed* `version.config.json`,** and that commit *is* `base`. This is what makes the scheme self-consistent with no tags and no stored SHA: editing the file to declare `2.0.0` makes that very commit `2.0.0`, with nothing else to keep in sync. It also gives the owner a manual override — the derived number is automatic, but the floor is always a hand-editable declaration. Rejected a `v1.0.0` git tag as the marker (the standard `git describe` approach) because a tag is state living outside the working tree: it has to be pushed separately, and a clone without tags silently computes a different answer.
  - **(d) Every commit moves the number.** An unprefixed commit is a patch, not a no-op, because the owner's rule was "increase on every commit". Merge commits are the one exception — their contents are already counted through the branch commits, so counting both would double-bump.
  - **Two things that look like details and are not.** The replay uses **`--topo-order`, not date order**: commits made in the same second can sort arbitrarily, and if a merged branch's `feat:` lands ahead of a `BREAKING CHANGE:`, the major bump resets the minor it just added and the same history yields two different versions. And the script **hard-fails on a shallow clone** — a truncated history resolves the baseline to the grafted tip and returns a stale number that looks entirely plausible, which is worse than an error. Hence `fetch-depth: 0` in the workflow.
  - **CI is now the only supported deploy path**, at the owner's direction — no mixing. `.git` is dockerignored, so the image cannot derive its own version; CI computes it and passes `--build-arg APP_VERSION`. A local `fly deploy` still runs, but with no build arg it ships an app reporting **`0.0.0-dev`**, which is the intended tell that an image never went through the pipeline.
  - **Cost:** deployment now depends on GitHub Actions and a `FLY_API_TOKEN` secret, and a red lint or typecheck blocks shipping. That gate is the point, but it means a hotfix cannot skip it — `workflow_dispatch` re-runs a deploy without an empty commit, and a genuine emergency falls back to a local `fly deploy` at the cost of a `0.0.0-dev` label.

---

## 10. Security checklist (must-pass before launch)

- [ ] Every authenticated DB access goes through the scoped access helper (owner / member / non-member tested).
- [ ] Guest route (`/m/[token]`) uses a privileged connection **server-side only** and returns read-only data; no privileged credentials reach the browser.
- [ ] All request bodies validated with Zod at the server boundary.
- [ ] `public_token` is high-entropy and unguessable; revoke sets `public_link_active = false` and takes effect immediately.
- [ ] Images served from the Tigris/R2 CDN, not proxied through the app. **Downloads too** — the archive is built in the browser (D24), so no route should ever stream image or video bytes.
- [ ] Exactly **one** unauthenticated write path exists (guest upload, D21). It is rate-limited, and video is charged to a **second, tighter budget** on top (`FR-VIDEO-7`, D25). Adding a second write path, or letting video through on the general limit alone, is a defect.
- [ ] Uploaded media is identified by **sniffing its bytes**, never by the client's `mime_type` — for video (`lib/video.ts`) as well as images.
- [ ] Every path that writes media calls `assertQuota` **before** the storage `PUT` (`FR-QUOTA-5`, D26) — the guest path included, since that is the one an anonymous visitor can reach. The guest refusal must not disclose the owner's usage (`FR-QUOTA-6`).
- [ ] Bucket CORS grants `GET`/`HEAD` to the app origin only, and no write method.
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
3. **Set the bucket's CORS rule — `npm run storage:cors -- https://your-app-domain`** (D24). Required by download (`FR-DL-5`), which reads objects with `fetch` rather than an `<img>` tag. **This is easy to forget and fails quietly:** every other feature works, and only downloading breaks, with a browser console error rather than an app-level one. Pass the production origin explicitly — see Section 7b for why running it bare is a trap.

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

### 11.7 Deploy — push to `main` (D28)

**Deployment is automated and there is only one path: push to `main`.** `.github/workflows/deploy.yml` lints, typechecks, derives the version (`FR-VER-1`) and runs `flyctl deploy`, passing the version in as a build arg. Migrations still run through `fly.toml`'s `release_command`.

One-time setup — mint a deploy token and store it as the `FLY_API_TOKEN` repository secret:

```bash
fly tokens create deploy -x 8760h
```

The command only **prints** the token; adding it to GitHub is a separate manual step
(Settings → Secrets and variables → Actions → New repository secret). **Paste the whole
value including the leading `FlyV1 ` and its space** — the token is two space-separated
parts, and a trimmed one fails with `no access token available. Please login with 'flyctl auth login'`, which misdirects you toward the CLI. The workflow checks for an empty token up front and says this, rather than letting flyctl report it.

Verify after a push: watch the run in the Actions tab (the summary names the version being shipped), then `fly logs`, open the site, and confirm the footer shows the expected number.

**Re-running without a new commit:** use the workflow's `workflow_dispatch` trigger ("Run workflow" in the Actions tab) rather than an empty commit — an empty commit would bump the version for no change.

⚠️ **A local `fly deploy` still works, and deliberately looks wrong when it happens.** `.git` is dockerignored, so the container cannot derive its own version; with no `APP_VERSION` build arg the app reports **`0.0.0-dev`** in the footer. That is the tell that an image bypassed the pipeline — treat it as a signal to redeploy through CI, not as a bug.

### 11.8 Custom domain + TLS
```bash
fly certs add app.yourdomain.com   # then add the shown DNS records at your registrar
```
Then update `NEXT_PUBLIC_APP_URL` and Neon Auth's **trusted domains / redirect URLs** to the custom domain.

### 11.9 Scaling & operations
- Region/scale: `fly scale count 1` (bump when needed); keep `min_machines_running = 1` so sessions and image caching are warm.
- Backups/branching: use Neon branches for staging/preview and Neon's point-in-time restore.
- Monitoring: `fly logs`, Fly metrics, and Neon's dashboard for DB load.
- CI/CD: **done, and now the only deploy path** — `.github/workflows/deploy.yml` runs `flyctl deploy` on push to `main` using a `FLY_API_TOKEN` secret (§11.7, D28). Deploys are serialised (`concurrency`) and never cancelled mid-flight, since an interrupted `flyctl deploy` can leave a release half-applied.

---

## 12. Out of scope (do not build)

**Moved.** The out-of-scope list now lives in **[Future-Functionalities.md](Future-Functionalities.md), Section 2** — kept alongside the deferred-work list so there is one place to look for "not in the build, and why". That document distinguishes *declined* (Section 2) from *wanted, later* (Section 1). The rule is unchanged: don't build these, and keep the schema and UI free of hooks for them so the build stays lean.

---

*End of implementation plan.*
