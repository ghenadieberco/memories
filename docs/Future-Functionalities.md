# Memories — Future Functionalities

| | |
|---|---|
| **Product** | Memories |
| **Version** | 0.1 (Draft) |
| **Date** | 10 August 2026 |
| **Status** | Backlog — captured, not approved for build |
| **Author** | Product owner (with assistance) |

---

## 0. Purpose and status of this document

This document is the single home for **everything deliberately not in the current build**. It covers two different things, and the difference matters:

| Section | Meaning | Rule |
|---|---|---|
| **[Section 1 — Deferred](#1-deferred-wanted-later)** | Functionality the owner **wants, later**. Captured, not scheduled, not specified to build-ready detail. | Don't build until asked. |
| **[Section 2 — Out of scope](#2-out-of-scope-do-not-build)** | Functionality that has been **declined**. | Don't build. Keep the schema and UI free of hooks for it. |

For what the app **does** do today, see [Current-Features.md](Current-Features.md) — the two documents are complements, and between them they should account for everything.

This page is not authoritative on anything that *is* being built: [Memories-App-Requirements.md](Memories-App-Requirements.md) wins on *what*, [Memories-Implementation-Plan.md](Memories-Implementation-Plan.md) on *how*, and [UI-Style-Guide.md](UI-Style-Guide.md) on appearance and copy.

**When a deferred item ships, move it in the same change:** give it a real `FR-` ID in the requirements doc, add its build steps to the implementation plan, delete its entry here, and describe the new behavior in [Current-Features.md](Current-Features.md). The `FF-*` IDs below are provisional and exist only so these items can be referenced in conversation.

**Numbering.** Every *feature* is numbered by its position — `1.1` in Section 1, `2.1`–`2.5` in Section 2 — so it can be pointed at by number. A number means "this is an item on the list"; unnumbered headings, like the cross-cutting reminders that close Section 1, are notes about the list rather than entries on it. The numbers are **positional, not stable**: removing or reordering an item renumbers the ones after it, and the numbers are expected to be resequenced in the same change — as they were when Section 1's first three entries shipped on 10 August 2026 and the slideshow moved up from `1.4` to `1.1`. When something needs a durable reference (a commit message, a code comment, another document), cite the `FF-*` ID instead.

---

## 1. Deferred (wanted, later)

> **Three items left this section on 10 August 2026** — FF-DL (download), FF-VIDEO (video support), and FF-VIEW-BIG (a larger viewer, built with zoom controls) were built and are now described in [Current-Features.md](Current-Features.md) §4, §5 and §6. They hold real requirement IDs — `FR-DL-1..7`, `FR-VIDEO-1..6`, `FR-VIEW-8/9` — and the decisions they forced are recorded as **D23** (video: store as uploaded, no transcode) and **D24** (download: assembled in the browser, guests included) in the implementation plan's Section 9.

### 1.1 FF-SLIDE — Slideshow

Play a memory's photos automatically, advancing on a timer, instead of clicking Forward each time.

Notes and open points:

- Needs, at minimum: a play/pause control, an interval (a sensible default, possibly a small set of speeds), and a clear way to stop and return to manual navigation.
- **Wraparound is the interesting question.** FR-VIEW-5 and D7 say the manual viewer stops at the ends and never wraps. A slideshow that stops dead on the last photo is defensible; one that loops is the more common expectation. Pick one deliberately and record it — if the slideshow loops while manual navigation doesn't, that difference should be intentional and documented, not an accident.
- Preloading matters more here than in manual mode. The viewer already warms the immediate neighbours; a timed advance may want to look further ahead.
- Accessibility: auto-advancing content needs a pause control and should respect `prefers-reduced-motion`, per the style guide's motion and a11y rules.
- **Video is now in the product, so the slideshow has to answer for it** (`FR-VIDEO-2`). Decide whether a timed advance plays a video through to its end, gives it the fixed interval like a photo, or skips it. Note the viewer deliberately does *not* prefetch video neighbours (`NFR-PERF`), which a slideshow's look-ahead would need to reconsider.
- **The viewer now has zoom** (`FR-VIEW-9`). Decide what a slideshow advance does to a zoomed photo — almost certainly reset to fit, matching what manual navigation already does.

### 1.2 FF-BILLING — Paid storage tiers

Raise a user's storage allowance beyond the default 20 GB in exchange for a subscription. Raised by the owner on 10 August 2026 while specifying the quota itself (`FR-QUOTA-*`, D26) — the quota shipped, the paid tier did not.

**Phase 7 already did the one thing that would have been expensive to retrofit:** the allowance lives in `profiles.storage_quota_bytes` per user rather than as an app constant, so granting an account more space is an `UPDATE`, not a migration. Everything else is unbuilt.

Notes and open points:

- **Nothing about payments exists.** No payment provider, no subscription state, no invoices, no webhook path, no dunning. That is a new vendor and a new recurring cost line — the same bar D23 set for an external transcoder, and it should be cleared just as deliberately.
- **Decide what happens when a subscription lapses** while the user is over the free allowance. The quota deliberately blocks uploading only and never withholds existing content (`FR-QUOTA-10`); a downgrade must not quietly turn into deletion. A read-only-until-resolved state is the humane reading, but it needs to be chosen and written down.
- **Tiers need a price that clears the true cost.** Tigris Standard is $0.02/GB/month with free egress, so 20 GB of *actually used* space costs about $0.40/month. Storage is recurring and only accumulates — a one-off payment for a permanent allowance is a permanent liability.
- **The meter's copy would change.** `FR-QUOTA-7`'s indicator says used vs total; a tiered product usually wants the total to be a link to an upgrade, which is a different component contract than the current read-only display.
- Admin-facing usage reporting doesn't exist either (D26 scoped it out explicitly) and is close to a prerequisite for supporting paid accounts.

### 1.3 FF-DUPES — Check for duplicates

Find media that is already in the app, so the same photo isn't stored — and paid for — twice. Requested by the owner on 10 August 2026, alongside the storage quota (`FR-QUOTA-*`), which is the reason it is worth doing: every duplicate spends quota the owner would rather keep.

Nothing is built. The shape of the feature is genuinely undecided, and the open points below are the reason — pick answers deliberately and write them into the requirements doc before any code.

**The first fork: when does it check?**

- **At upload**, warning before the file is stored — prevents the waste rather than cleaning it up, but puts work in the request path that already runs `sharp` under a time budget.
- **After the fact**, as a "find duplicates" review screen over what is already there — no upload cost, and it is the only mode that helps with the duplicates already in the bucket today.
- Both, eventually. If only one ships first, the review screen is the one that pays for itself immediately.

**The second fork: what counts as a duplicate?**

- **Exact bytes** — a hash (SHA-256) of the uploaded file, compared before storing. Cheap, exact, no false positives, and catches the common real case: the same file added twice from the same phone. ⚠️ **The image pipeline is the obstacle.** D5 discards the original and re-encodes to WebP, and `sharp` output is not guaranteed bit-identical across versions or across two visually identical inputs — so the hash must be taken of **the uploaded bytes, before processing**, and stored alongside the row. A hash of the optimized output would silently miss duplicates after any pipeline change.
- **Perceptual** (pHash/dHash) — catches a resized or re-compressed copy of the same photo, which is what "duplicate" usually means to a person with a camera roll. Costs a similarity search rather than an equality lookup, and it has false positives (burst shots, near-identical frames), so it cannot silently delete anything — it can only ever *propose*.

**Everything else this needs decided:**

- **Scope of the comparison.** Within one memory, across all of an owner's memories, or across memories shared with them? Cross-memory is the useful answer and the one with a privacy edge: never report a match against a memory the viewer cannot already see.
- **What the app does on a match.** Refusing an upload outright is wrong — the same photo in two memories is a legitimate thing to want. Warn and let the user decide; never auto-delete.
- **Guests.** A guest on a public link (D21/D25) uploading a duplicate is the most likely source of them. Whatever the flow is, a guest cannot be shown the owner's other memories in the process (`FR-QUOTA-6` sets the precedent: refusals to guests disclose nothing about the owner's account).
- **Storage doesn't shrink until objects are deleted.** De-duplicating rows while leaving the bucket untouched saves nothing — this must go through the same delete path that already removes storage objects (no orphans).
- **A hash column is cheap insurance.** Even before the feature is designed, recording the pre-processing hash of each upload would make an exact-match version a query later instead of a re-upload of everyone's library. Worth considering on its own.

### 1.4 FF-ACCOUNT-DELETE — Account deletion, from Settings

Let a signed-in user delete their own account, and everything belonging to it, from Profile & settings. Requested by the owner on 10 August 2026.

> **This one is different from the others on this list: it is already a requirement.** `NFR-PRIV` (§5.5) says the app shall "support account/data deletion (which cascades to owned memories, photos, comments, likes, and tags)". Nothing implements it. So this entry is not a new idea being parked — it is an **unmet obligation** being written down honestly, and it carries more weight than a wish. Give it a real `FR-` ID when it is built.
>
> **It is not the same as deactivation.** The admin console can already deactivate an account (D22): admin-driven, reversible, and it leaves every photo untouched. Deletion is user-driven, irreversible, and destroys data. Shipping deletion should not disturb deactivation — the app wants both.

**The blocker, verified against the live database.** Five foreign keys pointing at `profiles` are `NO ACTION`, so `DELETE FROM profiles` **fails today** with a constraint violation for any user who has ever uploaded a photo or shared a memory:

| Table.column | Delete rule | Why it's awkward |
|---|---|---|
| `photos.uploaded_by` | `NO ACTION` | Set null and the photo becomes indistinguishable from a guest upload (D21); cascade and deleting your account destroys photos inside **other people's** memories |
| `memory_shares.invited_by` | `NO ACTION` | **`NOT NULL`** — cannot be nulled, so this needs a real answer, not a default |
| `photo_tags.tagged_by` | `NO ACTION` | **`NOT NULL`** — same, though the table is unused (D20) |
| `persons.linked_user_id` | `NO ACTION` | Unused table (D20) |
| `app_settings.updated_by` | `NO ACTION` | The last admin to toggle maintenance mode can't be deleted |

The remaining five (`memories.owner_id`, `memory_shares.user_id`, `comments`, `likes`, `persons.owner_user_id`) are `CASCADE`, which is its own hazard — see below. **Whichever way each is resolved, it is a schema migration and a decision per column.**

**The trap that matters most: a cascade delete orphans every stored object.** `memories.owner_id` cascading to memories, and memories cascading to photos, removes *rows* — it does not touch the bucket. That silently violates the standing rule that deleting a memory or photo deletes its storage objects too. And since D26 derives quota usage from those rows, the orphaned bytes **disappear from accounting while Tigris keeps billing for them** — the worst kind of leak, because nothing in the app can see it. Deletion must therefore run through the application's own delete path (collect keys, delete objects, then rows), not by leaning on the database's cascade.

**The second trap: `profiles` is not the user.** Neon Auth owns the account record in `neon_auth.user`; `profiles` is only the app's side of it. Deleting the profile row leaves the credentials intact, and **Phase 1 creates a profile on first sign-in** — so the person can sign back in and be handed a fresh, empty account, which is not what "delete my account" means to anyone. The Neon Auth user has to go too. ⚠️ **Check whether the SDK can actually do this before promising the feature:** `@neondatabase/auth@0.4.2-beta`'s admin endpoints were found returning 404 during D22, which is why `profiles.role` exists at all.

**Everything else to decide:**

- **Media in other people's memories.** If a contributor deletes their account, do their uploads vanish from albums they don't own, or stay as unattributed content? Both are defensible; the owner of *that* album has a legitimate interest either way. Note that "stays, unattributed" makes it a guest upload in all but name — and only the memory owner can delete those.
- **Memories shared with other people** disappear for those people the moment the owner's account goes. Warn about that in the confirmation, naming how many people are affected.
- **Give the data back before taking it away.** Download already exists (`FR-DL-*`, D24) — offering "download everything first" as a step in the flow costs little and is the difference between a considerate deletion and a destructive one.
- **Confirmation has to be proportionate to irreversibility** — a typed confirmation, not a single button, and copy in the style guide's plain voice that says what is destroyed and that it cannot be undone.
- **`assertWritable(userId)` is mandatory** (D22) — deletion is a mutation, and maintenance mode must freeze it like any other.
- **Undo window?** A grace period (soft-delete now, purge in 30 days) is far kinder and much more work — it means a scheduled job, which this app has none of today. Decide deliberately; the existing `deactivated_at` column is *not* a free implementation of it, since deactivation means something else.

### Cross-cutting reminders for whoever picks this up

- The slideshow lives in the authenticated viewer *and* on the public `/m/[token]` route, which share one `PhotoViewer` component. Decide guest behaviour explicitly rather than letting it fall out of that sharing — as download did, deliberately, in D24.
- A slideshow is a read, so `assertWritable(userId)` (D22) does not apply — but the moment it grows a write (a saved speed preference, say), the guard is mandatory.
- Anything reaching the server still validates its input with Zod at the boundary.

---

## 2. Out of scope (do not build)

These are **declined**, not deferred. Moved here from the implementation plan's Section 12 and the requirements doc's Section 1.3, which now point at this list. Keep the schema and UI free of hooks for them so the build stays lean.

| # | Item | Note |
|---|---|---|
| **2.1** | **Face detection and recognition** | Identifying and grouping people across photos. Never in v1. |
| **2.2** | **Additional browsing views: timeline, map, search** | The Memories list and the per-memory grid are the only browsing surfaces. |
| **2.3** | **Native mobile apps** | The product is a responsive web app (assumption **A1**). |
| **2.4** | **User-configurable image optimization** | Deliberately locked. Optimization is mandatory and fixed (`NFR-OPT`, `FR-PROF-4`); the settings screen shows it as read-only and ON. |
| **2.5** | **Social features — comments, likes, people tagging** | Declined per **D20**. Requirements Section 3.7 (`FR-SOC-1..5`) is dead text; don't build from it without being asked. Tagging was built once and removed on request. The `comments`, `likes`, `persons`, and `photo_tags` tables remain in the schema, unused, on purpose — leaving them is not an invitation to use them. |

If one of these is ever revived, it moves up to Section 1 first and gets specified there — it does not go straight into code. **Video support** made exactly that move on 10 August 2026, and then made the rest of the journey the same day: it was specified into the requirements as `FR-VIDEO-1..6` and built. It is now in [Current-Features.md](Current-Features.md) §4. Older docs and comments that call video "out of scope" are stale.

---

*End of future functionalities.*
