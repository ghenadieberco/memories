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
| **Database** | A Postgres database — [Neon](https://console.neon.tech) is the target, but any local Postgres works for development |
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

Fill in `.env.local`. The two groups that matter for local development:

**Database** — create the Neon project in **AWS us-east-1 (N. Virginia)** to match
`primary_region = "iad"` in [fly.toml](fly.toml); Neon's region cannot be changed after
creation. Use the **pooled** connection string (its host contains `-pooler`):

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/memories?sslmode=require
```

<details>
<summary>Or use a local Postgres instead of Neon</summary>

```bash
docker run -d --name memories-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=memories postgres:17
```

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/memories
```

TLS is skipped automatically for `localhost` connections.
</details>

**Object storage** — `fly storage create` prints these once, so capture them:

```
S3_ENDPOINT=https://fly.storage.tigris.dev
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=...
S3_PUBLIC_URL=https://your-bucket.fly.storage.tigris.dev
```

The bucket must allow **public reads** — image bytes are served straight from its
CDN and are never proxied through the app.

Then create the tables:

```bash
npm run db:migrate
```

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

**`uploaded, but public URL returned 403`**
The upload worked, so your credentials are fine; the bucket isn't publicly readable or
`S3_PUBLIC_URL` points somewhere else. Check the bucket's visibility first.

**Connection times out against Neon**
Make sure you used the *pooled* connection string and kept `?sslmode=require`.

**HEIC uploads fail (Phase 2 onward)**
Known and expected. The prebuilt `sharp` binary decodes AVIF but not HEIC, so iPhone
photos in their default format need a decision — see the HEIC note in
[docs/Memories-Implementation-Plan.md](docs/Memories-Implementation-Plan.md) §11.4.

---

## Where things live

```
app/          routes — currently the status page and api/health
components/   shared UI (wordmark, shadcn components)
db/           schema.ts, migrations/, migrate.ts
lib/          env, db, storage, health
docs/         requirements, implementation plan, style guide, prototype,
              current features, future functionalities (deferred + out of scope)
scripts/      build tooling
```

Later phases fill this out per the implementation plan §3: `app/(auth)` for sign-in,
`app/(app)` for the authenticated area, `app/m/[token]` for the public guest album,
and `lib/image.ts` for the `sharp` pipeline.

`docs/` is the source of truth for this project — read the relevant document before
changing behavior, and update it in the same change when behavior intentionally moves.
