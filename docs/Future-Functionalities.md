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

---

## 1. Deferred (wanted, later)

### FF-DL — Download image / images / memory

Let a viewer download photos out of a memory.

| | |
|---|---|
| **Single photo selected** | Download the file **as is** — one image, no archive, no re-encoding. |
| **Multiple photos selected** | Download a **`.zip`** containing the selected images. |
| **Whole memory** | Download a **`.zip`** of every photo in the memory. |

Notes and open points:

- **"As is" means the stored optimized WebP, not the camera original.** Per D5 the original upload is discarded after optimization, so there is nothing else to hand back. Confirm the owner is happy with that before building, and make sure the UI copy doesn't promise an original.
- Filenames inside the zip, and the zip's own name, need deciding — likely `MemoryTitle - (Formatted Date).zip` to match FR-MEM-2, with per-photo names derived from capture date or upload order.
- **Where the bytes come from matters.** Photos are served straight from the Tigris public URL, and the non-negotiable is that image bytes are never proxied through the app. A single-file download can be a direct link to the CDN object. A zip cannot — it has to be assembled somewhere. Decide between streaming the archive from a server route (which does move bytes through the app, so it needs an explicit, documented exception) and building it in the browser from the CDN URLs. Settle this before any code.
- Multi-select already exists for bulk delete; the download action should reuse that selection, not introduce a second selection mode.
- **Access rules must hold.** Downloading is a read, so it goes through the same scoped access helper as viewing. Separately decide whether **guests on a public link** may download at all — FR-SHARE-9 makes public access view-only, and download is arguably beyond viewing. Recommend: off by default, and if it is ever allowed, make it a per-memory owner opt-in like `public_can_contribute` (D21).
- Large memories need a size or count ceiling and a progress indication; a silent multi-hundred-megabyte download is a bad outcome on mobile.

### FF-VIDEO — Video support

Allow videos alongside photos in a memory. **Previously declined; moved up to deferred on 10 August 2026.** Still unspecified — nothing here is settled.

Notes and open points:

- This is the largest item on the page by a wide margin, and it is not a variation on the photo path. Nearly every mandatory rule for images is image-specific and would need a video equivalent decided from scratch: the `sharp` pipeline (resize + WebP + thumbnail + EXIF, `NFR-OPT`) does not process video, so transcoding, poster-frame generation, and a "discard the original" answer (D5) all need their own decisions.
- Transcoding is the fork in the road: doing it in-process on the Fly machine competes with request serving and is slow for large files; an external service adds a vendor and a cost line. Decide before anything else, because the upload flow, progress reporting, and failure handling all follow from it.
- Storage and egress economics change materially — this is the strongest argument for the R2-vs-Tigris choice being revisited (plan, Section 1). Videos are large and read-heavy.
- Touches the data model (a media type on the photo record, duration, poster reference), the grid (a play affordance on the tile), the viewer (playback controls, which is a different component from the image viewer), upload limits, and accepted formats (`FR-PHOTO-2`).
- Interacts with everything else on this page: FF-DL has to decide what "download as is" means for a transcoded video, FF-SLIDE has to decide whether a slideshow plays a video through or skips it, and FF-VIEW-BIG's sizing rules apply to a video frame differently.
- Guest contribution (D21) would need an explicit decision — letting anonymous uploaders push large video files at a rate-limited public endpoint is a different risk profile from photos.

### FF-VIEW-BIG — Enlarge the viewer

The fullscreen viewer currently caps the image at `min(92vw, 760px)` wide and `72vh` tall ([components/photo-viewer.tsx:108-109](../components/photo-viewer.tsx#L108-L109)), which leaves noticeable empty space on a desktop screen. Give the photo more of the viewport.

Notes and open points:

- Raising the caps is the whole change in spirit, but the layout has to keep working: the nav controls overlay the image on narrow screens for a reason (they used to get pushed off-screen), and the `1 / N` counter sits below the image. Both need to survive a taller image.
- FR-VIEW-7 still governs — scale to fit, preserve aspect ratio, never upscale past the photo's own pixels. The optimized asset is ~2048px on its longest edge, so on a large display the ceiling is the file, not the CSS.
- Decide whether this is simply a bigger fixed cap or a **zoom / fit-to-screen toggle** the viewer offers. These are different features; the second one is much larger and interacts with FF-SLIDE.
- The style guide governs the surface — the frosted overlay, the control treatment, and the shadow stay as specified.

### FF-SLIDE — Slideshow

Play a memory's photos automatically, advancing on a timer, instead of clicking Forward each time.

Notes and open points:

- Needs, at minimum: a play/pause control, an interval (a sensible default, possibly a small set of speeds), and a clear way to stop and return to manual navigation.
- **Wraparound is the interesting question.** FR-VIEW-5 and D7 say the manual viewer stops at the ends and never wraps. A slideshow that stops dead on the last photo is defensible; one that loops is the more common expectation. Pick one deliberately and record it — if the slideshow loops while manual navigation doesn't, that difference should be intentional and documented, not an accident.
- Preloading matters more here than in manual mode. The viewer already warms the immediate neighbours; a timed advance may want to look further ahead.
- Accessibility: auto-advancing content needs a pause control and should respect `prefers-reduced-motion`, per the style guide's motion and a11y rules.
- Interacts with FF-VIEW-BIG — a slideshow is the case where a larger viewer pays off most. If both are built, build the sizing first.

### Cross-cutting reminders for whoever picks these up

- Every item here lives in the authenticated viewer *and* potentially on the public `/m/[token]` route. Decide guest behaviour explicitly for each one rather than letting it fall out of shared components.
- FF-DL, FF-VIEW-BIG, and FF-SLIDE are reads, so `assertWritable(userId)` (D22) does not apply — but the moment any of them grows a write (a saved slideshow speed, a download audit log), the guard is mandatory. **FF-VIDEO is a write path** and carries the guard from its first line of code.
- Anything reaching the server still validates its input with Zod at the boundary.
- FF-VIDEO changes the shape of the other three. If it is ever scheduled, sequence it first or accept reworking whatever was built before it.

---

## 2. Out of scope (do not build)

These are **declined**, not deferred. Moved here from the implementation plan's Section 12 and the requirements doc's Section 1.3, which now point at this list. Keep the schema and UI free of hooks for them so the build stays lean.

| Item | Note |
|---|---|
| **Face detection and recognition** | Identifying and grouping people across photos. Never in v1. |
| **Additional browsing views: timeline, map, search** | The Memories list and the per-memory grid are the only browsing surfaces. |
| **Native mobile apps** | The product is a responsive web app (assumption **A1**). |
| **User-configurable image optimization** | Deliberately locked. Optimization is mandatory and fixed (`NFR-OPT`, `FR-PROF-4`); the settings screen shows it as read-only and ON. |
| **Social features — comments, likes, people tagging** | Declined per **D20**. Requirements Section 3.7 (`FR-SOC-1..5`) is dead text; don't build from it without being asked. Tagging was built once and removed on request. The `comments`, `likes`, `persons`, and `photo_tags` tables remain in the schema, unused, on purpose — leaving them is not an invitation to use them. |

If one of these is ever revived, it moves up to Section 1 first and gets specified there — it does not go straight into code. **Video support** made exactly that move on 10 August 2026 and now sits in Section 1 as **FF-VIDEO**; older docs and comments that call video "out of scope" are stale.

---

*End of future functionalities.*
