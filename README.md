# Memories App

A responsive web app for organizing photos and videos into dated albums ("memories"),
browsing them as a thumbnail grid or in a zoomable fullscreen viewer, downloading them
individually or as a `.zip`, and sharing them with other people or via public links.

**Current status:** live. Phases 0–3 plus the owner-requested additions (guest
contributions, bulk delete, admin console) and Phase 6 (download, video, enlarged
viewer). Social features are out of scope. See [CLAUDE.md](CLAUDE.md) for status,
[docs/Current-Features.md](docs/Current-Features.md) for what it does today, and
[docs/](docs/) for the full spec.

---

## Prerequisites

| | |
|---|---|
| **Node** | 24 or newer (`node -v`) |
| **Database** | A [Neon](https://console.neon.tech) Postgres database. Neon Auth owns the `neon_auth` schema, so a plain local Postgres is **not** a substitute — see [Why not a local Postgres?](#why-not-a-local-postgres) |
| **Object storage** | An S3-compatible bucket — [Tigris](https://fly.io/docs/tigris/) via `fly storage create`, or Cloudflare R2 |
| **Docker** | Optional; only needed to build the production image |

You can run the app with neither a database nor a bucket — it starts and renders fine,
and the landing page simply reports both as "not ready". That's enough for styling and
component work, but nothing that touches data will function.

---

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`. Every value must be a **development** value — a Neon `dev` branch
and a separate `-dev` bucket, never the production pair. See
[Development uses its own database and bucket](#development-uses-its-own-database-and-bucket)
for why the two halves have to move together.

**Database** — create the Neon project in **AWS us-east-1 (N. Virginia)** to match
`primary_region = "iad"` in [fly.toml](fly.toml); Neon's region cannot be changed after
creation. Use the **pooled** connection string (its host contains `-pooler`), copied from
the console with the `dev` branch selected:

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=verify-full
```

`verify-full` is deliberate. The console hands you `sslmode=require`, which `pg` treats
identically today but warns about on every boot, because it weakens to libpq semantics in
`pg` v9 / `pg-connection-string` v3. Naming `verify-full` pins the behavior we already have.

**Neon Auth** — Neon console → Auth → Enable Auth → Configuration, with the `dev` branch
selected. Auth is branch-aware: each branch has an isolated auth environment, and existing
users and sessions are copied in when the branch is created, so your production account
can sign in on `dev` with its existing password.

```
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=<openssl rand -base64 32>
```

`NEON_AUTH_COOKIE_SECRET` is one you generate, not one you copy from the console — it's the
HMAC key for session cookies. Only `min(32)` is enforced, so pasting a URL in by mistake
validates and "works" while leaving sessions signed with a public value.

**Object storage** — `fly storage create` prints these once, so capture them:

```
S3_ENDPOINT=https://fly.storage.tigris.dev
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=...
S3_PUBLIC_URL=https://your-bucket.fly.storage.tigris.dev
```

⚠️ **Create dev buckets from a directory with no `fly.toml`.** `fly storage create` has no
`--no-attach` flag; run inside this repo it reads `fly.toml`, attaches the new bucket to the
Fly app, and **overwrites the production `AWS_*` / `BUCKET_NAME` secrets** — pointing the
live app at an empty bucket. Name the org explicitly instead:

```bash
cd ~ && fly storage create -o personal -n <app>-photos-dev -p -y
```

`-p` makes the bucket public. It must allow **public reads** — image bytes are served
straight from its CDN and are never proxied through the app — and without `-p` every
thumbnail 404s.

**Email** — `RESEND_API_KEY` can stay empty locally. With no key set, mail is logged to the
console instead of sent.

Then create the tables and allow the browser to fetch from the bucket:

```bash
npm run db:migrate
npm run storage:cors
```

`storage:cors` targets whichever bucket `.env.local` names, and bare it authorizes only
`localhost` — which is what you want for a dev bucket. Downloads fail without it while every
other feature works.

### Development uses its own database and bucket

| | Development | Production |
|---|---|---|
| Neon branch | `dev` | default branch |
| Neon Auth | the `dev` branch's own auth environment | the default branch's |
| Tigris bucket | `<app>-photos-dev` | `<app>-photos` |

**Split both, or neither.** A dev database pointed at the production bucket is *worse* than
sharing both: deleting a test photo locally would destroy an object the live app still has a
row for, and production would start serving broken images.

⚠️ **Console-created Neon branches default to a 1-day expiration**, after which the branch
and its auth environment are permanently deleted. After creating one: Branches → the branch
→ Actions → Edit expiration → toggle off *"Automatically delete branch after"*. Branches
created via the API or CLI have no expiration.

A new branch copies the `photos` rows, whose keys point into the *production* bucket, so
pre-existing media 404s in development. Delete the copied memories on the branch and create
test data rather than mirroring objects across.

### Why not a local Postgres?

The app's own tables would migrate fine, but **Neon Auth owns the `neon_auth` schema and
syncs it into its own database** — a local Postgres will never receive `neon_auth.user`.
You'd sign in against remote Neon Auth while reading data from a database with no user
table, so sharing by email ([lib/sharing.ts](lib/sharing.ts)) and the admin console
([lib/admin.ts](lib/admin.ts)) fail while most other things appear to work. Use a Neon `dev`
branch instead.

## Run it

```bash
npm run dev
```

Open <http://localhost:3000>. The landing page runs both round-trip checks and shows
their status; two green rows means your environment is fully wired up.

You can also query the checks directly:

```bash
curl localhost:3000/api/health          # database only (cheap)
curl "localhost:3000/api/health?deep=1" # also writes + reads a real storage object
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (standalone output) |
| `npm start` | Serve a production build |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration after editing `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run db:bundle-migrate` | Bundle the migrator for the container (used by the Docker build) |
| `npm run storage:cors -- <origin>` | **Run once per bucket.** Allows the browser to `fetch` stored files, which downloads need. Without it, downloading fails while everything else works. Pass the production origin — bare, it only authorises `localhost` |

## Building the container

```bash
docker build -t memories .
docker run --rm -p 3000:3000 --env-file .env.local memories
```

---

## Troubleshooting

**`Missing database configuration` / `Missing object storage configuration`**
`.env.local` is absent or incomplete. The message names the exact variables it needed.

**`connected in Nms, but only 0/8 tables exist`**
The database is reachable but empty — run `npm run db:migrate`.

**Uploading a photo shows `We couldn't store <file>` and the grid refreshes**
Almost always incomplete storage config. `storageEnv()` throws the moment the upload route
reaches storage, and the route returns it as a 502; the refresh is the client re-syncing the
grid. Check that `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_BUCKET` are non-empty and
that `S3_PUBLIC_URL` isn't still the `your-bucket` placeholder. `curl "localhost:3000/api/health?deep=1"`
confirms it — it writes and reads a real object.

**`uploaded, but public URL returned 403`**
The upload worked, so your credentials are fine; the bucket isn't publicly readable or
`S3_PUBLIC_URL` points somewhere else. Check the bucket's visibility first.

**Sharing by email finds nobody, or the admin console lists no users**
`relation "neon_auth.user" does not exist` — `DATABASE_URL` points at a database Neon Auth
doesn't manage, typically a local Postgres. See
[Why not a local Postgres?](#why-not-a-local-postgres).

**Connection times out against Neon**
Make sure you used the *pooled* connection string (its host contains `-pooler`) and kept an
`sslmode` on it — `verify-full`.

**Downloads fail while everything else works**
The bucket has no CORS rule. Run `npm run storage:cors`.

**HEIC uploads fail (Phase 2 onward)**
Known and expected. The prebuilt `sharp` binary decodes AVIF but not HEIC, so iPhone
photos in their default format need a decision — see the HEIC note in
[docs/Memories-Implementation-Plan.md](docs/Memories-Implementation-Plan.md) §11.4.

---

## Where things live

```
app/(auth)/   sign-in, sign-up, verify, forgot/reset password
app/(app)/    the authenticated area — memories, shared, settings, admin
app/m/        the public guest album at /m/[token]
app/api/      auth proxy, health, photo upload
components/   shared UI (viewer, cards, menus, shadcn components in ui/)
db/           schema.ts, migrations/, migrate.ts
lib/          env, db, access control, storage, image/video pipelines, sharing
docs/         requirements, implementation plan, style guide, prototype,
              current features, future functionalities (deferred + out of scope)
scripts/      build tooling, bucket CORS, one-off backfills
```

`docs/` is the source of truth for this project — read the relevant document before
changing behavior, and update it in the same change when behavior intentionally moves.
