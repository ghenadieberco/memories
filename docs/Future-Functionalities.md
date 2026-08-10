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
