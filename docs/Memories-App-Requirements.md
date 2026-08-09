# Memories — Application Requirements Document

| | |
|---|---|
| **Product** | Memories |
| **Version** | 1.2 (Draft) |
| **Date** | 9 August 2026 |
| **Status** | Draft for review |
| **Author** | Product owner (with assistance) |

---

## 1. Overview

### 1.1 Purpose
This document defines the functional and non-functional requirements for **Memories**, a photo application that lets a registered user organize their photos into dated, named albums ("memories") and browse them as thumbnails or in a fullscreen viewer.

### 1.2 Product summary
A user signs in, creates a **memory** (a named album tied to a date, displayed as `MemoryTitle - (Formatted Date)`), and uploads photos into it. Uploaded images are automatically optimized to reduce file size. Photos within a memory are shown as a thumbnail grid and can be opened in a fullscreen viewer with manual forward/back navigation.

### 1.3 Scope

**In scope for v1**
- User registration, login, logout, and session management
- Password reset and (assumed) email verification
- The primary logged-in view: **Memories**
- Creating, viewing, editing, and deleting memories
- Uploading photos into a memory, with automatic image optimization
- Thumbnail grid display of photos
- Fullscreen photo viewer with manual forward/back navigation
- Basic profile management (update name, change password)
- **Sharing memories** with other users (collaborative contribution) and via **public view-only links**
- **Social features** on photos/memories: comments, likes, and people tagging

> **Scope note:** Sharing and social features (comments, likes, people tagging) change this from a private single-user app into a collaborative product. They are documented here as in-scope per direction; see the Scope-phasing note in Section 8 for a suggested delivery order.

**Out of scope (candidate future work)**
- Face detection and recognition to identify and group people across photos
- Additional browsing views: timeline, map, and search
- Native mobile apps (unless confirmed — see Open Questions)
- User-configurable image optimization (deliberately locked)
- Video support

---

## 2. User roles

| Role | Description |
|---|---|
| **Guest** | Unauthenticated visitor. Can access register, login, and password-reset screens, and can **view a single memory album (read-only) when opening a valid public link**. |
| **User** | Authenticated account holder. Can manage their own profile, memories, and photos, and access memories shared with them. |

> v1 has no admin role. A `role` field is reserved on the user record for future use.

---

## 3. Functional requirements

### 3.1 Authentication & account

| ID | Requirement |
|---|---|
| FR-AUTH-1 | The system shall provide a **registration** screen collecting email, password, and display name. |
| FR-AUTH-2 | The system shall provide a **login** screen accepting email and password. |
| FR-AUTH-3 | The system shall enforce **password rules**: minimum 8 characters, at least one letter and one number (configurable), with a strength indicator on registration. |
| FR-AUTH-4 | Passwords shall be **hashed** (bcrypt or Argon2id) and never stored or logged in plaintext. |
| FR-AUTH-5 | The system shall support **logout**, invalidating the active session. |
| FR-AUTH-6 | The system shall maintain sessions via secure tokens (e.g., JWT or server session) stored in an httpOnly, Secure cookie. |
| FR-AUTH-7 | The system shall provide a **password reset** flow using a single-use, time-limited token sent by email. |
| FR-AUTH-8 | The system shall send an **email verification** link on registration and mark the account verified when confirmed. *(Assumed — see Open Questions.)* |
| FR-AUTH-9 | The system shall **rate-limit** login attempts and lock or throttle an account after repeated failed attempts (e.g., 5) to mitigate brute-force attacks. |
| FR-AUTH-10 | On successful login the user is taken directly to the **Memories** view. |
| FR-AUTH-11 | All authenticated actions shall verify that the requesting user owns the target resource (memory/photo) before proceeding. |

### 3.2 User profile & settings

| ID | Requirement |
|---|---|
| FR-PROF-1 | The user shall be able to view their profile (display name, email, account created date). |
| FR-PROF-2 | The user shall be able to **update their display name**. |
| FR-PROF-3 | The user shall be able to **change their password**, requiring entry of the current password and confirmation of the new one. |
| FR-PROF-4 | The settings screen shall display an **"Image optimization"** control that is **ON by default and read-only** (visible but not editable by the user). |
| FR-PROF-5 | Non-editable identity fields (e.g., account ID, created date) shall be displayed as read-only. |

### 3.3 Memories (albums)

| ID | Requirement |
|---|---|
| FR-MEM-1 | The user shall be able to **create a memory** by providing a **title** and a **date**. |
| FR-MEM-2 | Each memory shall be displayed with the label format **`MemoryTitle - (Formatted Date)`** (e.g., `Beach Trip - (14 Jul 2026)`). |
| FR-MEM-3 | The **Memories** view shall list all of the user's memories, each shown as a bucket/album with its label and a representative cover image (or a placeholder if empty). |
| FR-MEM-4 | Memories shall be ordered by date (most recent first by default). |
| FR-MEM-5 | The user shall be able to **open a memory** to see the photos it contains. |
| FR-MEM-6 | The user shall be able to **edit** a memory's title and date. |
| FR-MEM-7 | The user shall be able to **delete** a memory, with a confirmation prompt; deleting a memory deletes its photos and associated stored files. |
| FR-MEM-8 | Each memory shall show a **photo count**. |
| FR-MEM-9 | The user shall be able to **set a memory's thumbnail (cover) image** by selecting one of the photos already contained in that memory. |
| FR-MEM-10 | The user shall alternatively be able to set the thumbnail by **uploading a custom image** dedicated to the cover. A custom cover shall be optimized like any other upload (NFR-OPT) and shall **not** appear in the memory's photo grid. |
| FR-MEM-11 | If the user has not set a thumbnail, the system shall use a **default** (e.g., the most recent photo in the memory), falling back to a placeholder when the memory is empty. |
| FR-MEM-12 | Setting, changing, or clearing a memory's thumbnail shall be reflected immediately in the Memories list. |

### 3.4 Photos

| ID | Requirement |
|---|---|
| FR-PHOTO-1 | The user shall be able to **upload one or more photos** into a specific memory. |
| FR-PHOTO-2 | The system shall accept common image formats (JPEG, PNG, WebP, HEIC — *format list to confirm*) and reject unsupported or oversized files with a clear error. |
| FR-PHOTO-3 | On upload, the system shall **automatically optimize** each image (resize + compress) and generate a **thumbnail** — see NFR-OPT. |
| FR-PHOTO-4 | Uploaded image files shall be stored in object storage; only metadata and file references are stored in the database. |
| FR-PHOTO-5 | The system shall show upload progress and handle partial failures gracefully (per-file success/failure). |
| FR-PHOTO-6 | The user shall be able to **delete a photo** from a memory, with confirmation; the underlying stored files (optimized + thumbnail) shall also be removed. |
| FR-PHOTO-7 | Photos within a memory shall have a defined **display order** used by the grid and fullscreen viewer (default: upload order or capture time — to confirm). |

### 3.5 Photo viewing (grid + fullscreen)

| ID | Requirement |
|---|---|
| FR-VIEW-1 | Photos in a memory shall be displayed as a **responsive thumbnail grid**. |
| FR-VIEW-2 | Thumbnails shall load quickly using the generated thumbnail assets and lazy loading. |
| FR-VIEW-3 | Selecting a thumbnail shall open a **fullscreen viewer** showing the optimized (full-display) version of that photo. |
| FR-VIEW-4 | The fullscreen viewer shall provide **manual Forward and Back buttons** to move to the next/previous photo in the memory. |
| FR-VIEW-5 | Forward/Back controls shall be disabled (or hidden) at the first/last photo (no wraparound by default — to confirm). |
| FR-VIEW-6 | The viewer shall provide a **Close** control returning the user to the thumbnail grid at the same scroll position. |
| FR-VIEW-7 | The viewer shall scale each image to fit the screen while preserving aspect ratio. |

### 3.6 Sharing & collaboration

| ID | Requirement |
|---|---|
| FR-SHARE-1 | A memory owner shall be able to **share a memory** with another registered user (by email or username). |
| FR-SHARE-2 | Sharing shall support at least two permission levels: **Viewer** (can view photos, comment, like) and **Contributor** (can additionally add photos). |
| FR-SHARE-3 | Memories shared with a user shall appear in a distinct **"Shared with me"** area, separate from their own memories. |
| FR-SHARE-4 | The owner shall be able to see who a memory is shared with and **revoke access** at any time. |
| FR-SHARE-5 | Only the **owner** may delete a shared memory or edit its title/date. A Contributor may add photos and remove photos they added; a Viewer may not modify content. *(Final delete rules to confirm.)* |
| FR-SHARE-6 | The system shall notify a user (in-app and/or email) when a memory is shared with them. |
| FR-SHARE-7 | Each memory shall be assigned an **unguessable public-link token** when it is first created. The owner shall be able to share this **public link** to grant view-only access. |
| FR-SHARE-8 | A person who opens a valid public link **without signing in (a guest)** shall be able to view the memory album — its title, formatted date, photo thumbnail grid, and the fullscreen viewer. |
| FR-SHARE-9 | Guest access via a public link is strictly **read-only**: a guest cannot add, edit, or delete photos; cannot comment, like, or tag; cannot see the owner's other memories; and cannot reach any account or settings features. |
| FR-SHARE-10 | The owner shall be able to **revoke or regenerate** a memory's public link at any time; revoking immediately invalidates the previous link so it no longer opens the album. |
| FR-SHARE-11 | Every access check shall grant access only if the requester is the **owner**, an **active member** with sufficient permission, or a **guest presenting a valid, non-revoked public link** (view-only). |

### 3.7 Social: comments, likes & people tagging

**Comments**

| ID | Requirement |
|---|---|
| FR-SOC-1 | A user with access to a memory shall be able to **comment** on a photo (and, optionally, on the memory itself). |
| FR-SOC-2 | Comments shall display author, text, and timestamp. A user may delete their own comment; the memory owner may delete any comment on their memory. |

**Likes**

| ID | Requirement |
|---|---|
| FR-SOC-3 | A user with access shall be able to **like/unlike** a photo (and, optionally, a memory); the system tracks and displays like counts. |

**Tagging**

| ID | Requirement |
|---|---|
| FR-SOC-4 | A user shall be able to **tag a person** in a photo — either another app user or a named person label. |
| FR-SOC-5 | Tags shall be visible on the photo and usable as a **filter** criterion within a memory. A user may remove a tag; a tagged person (if an app user) may remove a tag of themselves. |

---

## 4. Data model

> Field types are indicative. All tables include an auto-generated primary key and audit timestamps.

### 4.1 User

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | string, unique | Login identifier |
| `email_verified` | boolean | Default `false` |
| `password_hash` | string | bcrypt/Argon2id — never plaintext |
| `display_name` | string | Editable by user |
| `role` | enum | Default `user`; reserved for future |
| `image_optimization_enabled` | boolean | **Always `true`**, read-only to user |
| `failed_login_attempts` | int | For lockout logic |
| `locked_until` | datetime, nullable | Set when throttled/locked |
| `last_login_at` | datetime, nullable | |
| `password_reset_token` | string, nullable | Hashed, single-use |
| `password_reset_expires_at` | datetime, nullable | |
| `created_at` / `updated_at` | datetime | Audit |

### 4.2 Memory

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID (FK → User) | Owner |
| `title` | string | Displayed as part of `Title - (Date)` |
| `memory_date` | date | Date the memory represents |
| `cover_source` | enum | `auto` (default) / `photo` / `custom` — how the thumbnail is determined |
| `cover_photo_id` | UUID (FK → Photo), nullable | Chosen in-memory photo, used when `cover_source = photo` |
| `cover_image_key` | string, nullable | Object-storage key for a custom uploaded cover, used when `cover_source = custom` |
| `cover_thumbnail_key` | string, nullable | Optimized thumbnail of the custom cover |
| `public_token` | string, unique | Unguessable, high-entropy token generated at creation; used to build the public link |
| `public_link_active` | boolean | Whether the public link currently grants guest access (default `true`); set to `false` on revoke |
| `created_at` / `updated_at` | datetime | Audit |

### 4.3 Photo

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `memory_id` | UUID (FK → Memory) | Parent bucket |
| `user_id` | UUID (FK → User) | Owner (denormalized for authorization) |
| `storage_key` | string | Object-storage key for the optimized image |
| `thumbnail_key` | string | Object-storage key for the thumbnail |
| `original_filename` | string | As uploaded |
| `mime_type` | string | e.g., `image/webp` |
| `width` / `height` | int | Of the optimized image |
| `optimized_size_bytes` | int | After optimization |
| `original_size_bytes` | int | Before optimization (optional, useful for reporting) |
| `uploaded_by` | UUID (FK → User) | Who uploaded it (may differ from memory owner in a shared memory) |
| `taken_at` | datetime, nullable | Capture time, extracted from EXIF before stripping (used for sorting) |
| `sort_order` | int | Position within the memory |
| `status` | enum | `uploading` / `ready` / `failed` |
| `created_at` | datetime | Upload time |

### 4.4 MemoryShare (membership)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `memory_id` | UUID (FK → Memory) | Shared memory |
| `user_id` | UUID (FK → User) | The member the memory is shared with |
| `permission` | enum | `viewer` / `contributor` |
| `invited_by` | UUID (FK → User) | Usually the owner |
| `status` | enum | `pending` / `accepted` / `revoked` |
| `created_at` | datetime | |

### 4.5 Comment

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `photo_id` | UUID (FK → Photo), nullable | Target photo (if commenting on a photo) |
| `memory_id` | UUID (FK → Memory), nullable | Target memory (if commenting on a memory) |
| `user_id` | UUID (FK → User) | Author |
| `body` | text | |
| `created_at` | datetime | |

### 4.6 Like

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID (FK → User) | Who liked |
| `photo_id` | UUID (FK → Photo), nullable | Liked photo |
| `memory_id` | UUID (FK → Memory), nullable | Liked memory |
| `created_at` | datetime | Unique on `(user_id, photo_id)` / `(user_id, memory_id)` to prevent duplicate likes |

### 4.7 Person

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `owner_user_id` | UUID (FK → User) | The account whose "people" list this belongs to |
| `name` | string | Person's name/label |
| `linked_user_id` | UUID (FK → User), nullable | Set if the person is also an app user |

### 4.8 PhotoTag (people)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `photo_id` | UUID (FK → Photo) | Tagged photo |
| `person_id` | UUID (FK → Person), nullable | Who is tagged |
| `tagged_by` | UUID (FK → User) | Who created the tag |
| `created_at` | datetime | |

---

## 5. Non-functional requirements

### 5.1 Security (NFR-SEC)
- Enforce HTTPS/TLS for all traffic.
- Hash all passwords with a modern algorithm (bcrypt or Argon2id); never store, log, or return plaintext passwords or hashes.
- Validate and sanitize all inputs server-side; guard against SQL injection, XSS, and CSRF.
- Use single-use, time-limited tokens for password reset and email verification.
- Rate-limit authentication endpoints and lock accounts after repeated failures.
- Store secrets and storage credentials outside source control (environment/secret manager).
- Serve uploaded images via signed/scoped URLs so files are not publicly enumerable.
- Enforce authorization on every request: access to a memory (and its photos, comments, likes, and tags) requires being the **owner**, an **active shared member** with sufficient permission, or a **guest with a valid, active public link** (view-only) — all other access is denied.
- **Public links** shall use a high-entropy, unguessable token (so albums cannot be discovered by guessing) and shall be **revocable**; a revoked link must stop working immediately. Guest access resolved from a public link is scoped strictly to that single memory and is read-only, including for image URLs served to guests.

### 5.2 Image optimization (NFR-OPT)
- Optimization is **enabled by default and cannot be disabled by the user** (read-only setting).
- On upload, each image shall be **resized** to a maximum display dimension (e.g., longest edge ~2048 px) and **re-compressed** (e.g., WebP/JPEG at ~80% quality) — exact targets to be tuned.
- A separate **thumbnail** (e.g., longest edge ~400 px) shall be generated for the grid.
- **Before any metadata is stripped**, the system shall extract and persist **capture time** (`taken_at`, used for photo sorting) into the database. Remaining non-essential metadata (including GPS location) may then be stripped from the stored file for size and privacy.
- Both the optimized image and the thumbnail are stored; the original may optionally be discarded after optimization (to confirm — affects storage cost and whether originals are recoverable).

### 5.3 Performance (NFR-PERF)
- Thumbnail grids shall use lazy loading and pagination/infinite scroll for large memories.
- Fullscreen navigation should feel instant; the next/previous image may be preloaded.
- Uploads should be non-blocking with visible progress.

### 5.4 Storage & data (NFR-STOR)
- Image binaries live in object storage; the database holds only metadata and references.
- Target scale (informing sizing, not a hard limit): ~100 users and ~60 GB of new photo storage per year.
- Deleting a memory or photo shall also remove its stored files to avoid orphaned data and cost.

### 5.5 Privacy (NFR-PRIV)
- By default, a user's memories and photos are private; they become visible to others **only** through explicit sharing, and only to the members granted access.
- Handle personal data (email, images) in line with applicable data-protection expectations; support account/data deletion (which cascades to owned memories, photos, comments, likes, and tags).
- **Tagging & sharing exposure:** tagging a person can reveal their presence in a photo, and shared content is visible to all members the owner grants access to. Provide controls to remove tags (including self-removal by a tagged app user) and to revoke shares.
- **Public-link exposure:** a public link is *unlisted* (unguessable) rather than *private* — anyone who obtains the link can view that memory without an account, and links can be forwarded. Because of this, the owner must be able to revoke a link at any time, and it may be worth warning the owner at the point of sharing. Note the default: every memory's public link is active from creation (see Open Questions if you'd prefer it disabled until the owner explicitly turns it on).

### 5.6 Usability & accessibility (NFR-UX)
- Responsive layout that works on phone and desktop screen sizes.
- Clear, actionable error and empty states (e.g., no memories yet, upload failed).
- Interactive controls should be keyboard-accessible and screen-reader-labelled where feasible.

### 5.7 Compatibility (NFR-COMPAT)
- Support current versions of major browsers. *(Platform — web vs. native mobile — to be confirmed; see Open Questions.)*

### 5.8 Deployment (NFR-DEPLOY) — preferred infrastructure
- **App hosting:** Fly.io (the Next.js app runs as a container close to users).
- **Database + authentication:** Neon (serverless Postgres) with **Neon Auth** for managed users, sessions, email verification, and password reset.
- **Photo/object storage:** Tigris (Fly-native, S3-compatible) by default, or Cloudflare R2 (free egress) — both S3-compatible, so the storage code is identical either way.
- **Email:** Resend (verification, reset, share notifications).
- **Delivery:** deployed over HTTPS/TLS with a custom domain; secrets held in the platform's secret store, never in source control.
- Full, step-by-step deployment instructions live in the companion **Implementation Plan**; this section records the chosen infrastructure at requirements level only.

---

## 6. Screen / navigation map

1. **Register** → (email verification) → Login
2. **Login** → Memories
3. **Password reset** (request → email link → set new password)
4. **Memories (home)** — the user's own memory buckets
5. **Shared with me** — memories other users have shared with the user
6. **Memory detail** — thumbnail grid of photos in a memory
7. **Fullscreen viewer** — one photo, forward/back/close, with comments, likes, and people tags
8. **Public memory (guest view)** — read-only album (label, thumbnail grid, fullscreen viewer) opened from a public link, no sign-in
9. **Profile & settings** — edit name, change password, and a read-only image-optimization setting

---

## 7. Assumptions

- **A1** — The app is a responsive **web application** for v1 (native mobile is out of scope until confirmed).
- **A2** — A memory's date is set at creation (defaulting to today) and is user-editable; the app does **not** auto-group photos into day buckets by EXIF date — the user manually creates and fills each memory.
- **A3** — Multiple memories may share the same date (no "one memory per day" rule enforced).
- **A4** — Email verification is required before full use.
- **A5** — Standard CRUD (edit/delete) is available for memories and photos, even though the brief emphasized create/view.
- **A6** — Preferred deployment stack (confirmed): **Fly.io** (host) + **Neon** (Postgres + Neon Auth) + **Tigris or Cloudflare R2** (photo storage) + **Resend** (email). See NFR-DEPLOY and the Implementation Plan for details.
- **A7** — Registered-user sharing supports two permission levels, **Viewer** and **Contributor**. Additionally, each memory has a **public view-only link** (unguessable token, generated at creation, active by default, revocable) that lets anyone view the album as a guest without an account.
- **A8** — "Tagging" means identifying **people** in a photo, not free-form keyword tags. Keyword tags could be added later.
- **A9** — Guests reaching a memory via a public link get **read-only** access to that single album only — no commenting, liking, tagging, uploading, or access to the owner's other content or account.

---

## 8. Open questions / clarifications needed

1. **Platform** — Web app only, native mobile (iOS/Android), or both? This materially affects several requirements.
2. **Memory ⇄ date semantics** — Is the date chosen by the user, taken from the memory's creation day, or derived from the photos' capture dates? And should the app **auto-group** photos into per-day buckets, or is it purely manual (as assumed in A2)?
3. **One-per-day vs. many** — Can a user have multiple memories on the same date, or is each date a single bucket?
4. **Originals** — After optimization, do you want to keep the original full-resolution file (higher storage cost, but recoverable/downloadable) or discard it?
5. **Accepted formats & limits** — Which image formats must be supported (HEIC from iPhones?), and is there a max file size or per-memory / per-user photo limit?
6. **Email changes** — Should users be able to change their account email (with re-verification), or is email fixed after registration?
7. **Fullscreen wraparound** — At the last photo, should Forward wrap to the first, or stop (as assumed)?
8. **Download/share** — Should users be able to download a photo from the fullscreen viewer, or is viewing only?
9. **Sharing model** — Public view-only links are now confirmed. Remaining: can a Contributor delete photos others added, or only their own? Should a memory's public link be **active by default at creation** (current assumption) or **disabled until the owner explicitly enables it**? Should the public view show photo captions/metadata or images only?
10. **Comments & likes targets** — On photos only, on memories only, or both?

### Scope-phasing note
Sharing and social features are meaningful additions to the original single-user app. A sensible delivery order, if you want to reduce risk, would be:
- **Phase 1:** core app (auth, memories, photos, viewer, optimization).
- **Phase 2:** sharing & collaboration.
- **Phase 3:** comments, likes, and people-tagging.

This is a recommendation only; everything above is documented as in-scope per your direction.

---

*End of document.*
