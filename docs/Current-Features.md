# Memories — Current Features

| | |
|---|---|
| **Product** | Memories |
| **Version** | 1.1 |
| **Date** | 10 August 2026 |
| **Status** | Live at <https://memories.ghenadie-berco.com> |
| **Covers** | Everything working in the app today |

---

## 0. About this document

A plain-language catalogue of **what the app can do right now** — written to be read, not implemented from. It is the counterpart to [Future-Functionalities.md](Future-Functionalities.md), which lists what is *deferred* and what is *declined*.

It is descriptive, not authoritative. [Memories-App-Requirements.md](Memories-App-Requirements.md) remains the source of truth for *what* the product should do (and holds the `FR-` IDs), [Memories-Implementation-Plan.md](Memories-Implementation-Plan.md) for *how*, and [UI-Style-Guide.md](UI-Style-Guide.md) for how it looks and reads.

**Keep this current.** As each Future Functionality is built, move it here and remove it from that document in the same change.

**Numbering.** Every feature is numbered within its section, so it can be pointed at as *section*.*item* — feature **4.3** is the third entry under section 4. The numbers are **positional, not stable**: inserting or removing an entry renumbers the ones after it. When a reference needs to survive an edit — a commit message, a code comment, another document — cite the `FR-` ID from the requirements doc instead.

---

## 1. Getting in

1. **Sign up** with a name, email address, and password.
2. **Verify your email** with a 6-digit code sent to your inbox — you enter the code in the app rather than clicking a link.
3. **Sign in** and **sign out**.
4. **Password rules are enforced as you type**: at least 8 characters with at least one letter and one number, with a live strength meter.
5. **Forgot your password?** Request a reset, get a 6-digit code by email, and set a new password.
6. If someone shares a memory with an email address that hasn't registered yet, **the invitation is waiting for them the moment they sign up**.

## 2. Your memories

1. **Create a memory** by giving it a title and a date.
2. Every memory is labelled **`Title - (Date)`** — for example, `Beach Trip - (14 Jul 2026)`.
3. **The memories list** shows all of your memories as cards with a cover image and a count of what's inside, **newest date first**.
4. **Open a memory** to see what's in it.
5. **Edit** a memory's title or date at any time.
6. **Delete** a memory, with a confirmation step. Everything in it, and every stored file, goes with it.
7. **Choose a cover image** for a memory by picking any photo already inside it, and **reset the cover** to go back to the automatic choice.
8. If you haven't chosen a cover, one is picked for you; an empty memory shows a placeholder.

## 3. Adding photos

1. **Upload one or many photos** into a memory at once.
2. **JPEG, PNG, WebP, and HEIC** are all accepted — iPhone photos work without converting anything first.
3. **Up to 25 MB per photo.**
4. **Progress is shown while uploading**, and each file succeeds or fails on its own — one bad file doesn't sink the batch.
5. **Every photo is optimized automatically.** It's resized, converted to a smaller modern format, and given a thumbnail. There's no setting to fiddle with, and no way to upload an unoptimized file.
6. **The date the photo was taken is read from the camera data** and used to order it, then **the rest of that data — including GPS location — is stripped** before the file is stored.
7. **Photos are ordered by when they were taken**, falling back to upload time for photos with no camera date.

## 4. Adding videos

1. **Upload videos into a memory** the same way, and from the same button, as photos — they sit side by side in one grid.
2. **MP4 and WebM are accepted**, which between them covers what phones and cameras normally produce.
3. **Up to 100 MB per video** — a separate, larger limit than the one for photos.
4. **Videos are kept exactly as you uploaded them.** Unlike photos, they are not re-encoded or shrunk, so nothing is lost — and nothing is saved either. The 100 MB limit is what keeps that honest.
5. **A still frame is taken from the video by your own browser** and becomes its thumbnail. If your browser can't read the video, the upload is refused right there, so you never end up with a tile that won't play.
6. **Video files keep their own metadata.** Photos have theirs stripped, including GPS; videos are stored untouched, so anything the camera recorded inside the file stays there. Worth knowing before sharing a link.
7. **Videos sort by when they were uploaded**, since video files rarely carry a reliable capture date.
8. **Guests adding photos through a public link can't add videos** — that stays open to photos only.

## 5. Looking at photos and videos

1. **A responsive thumbnail grid** that adapts from phone to desktop and loads thumbnails lazily as you scroll.
2. **Videos are marked in the grid** with a play symbol and their length, so you can tell them from photos at a glance.
3. **A fullscreen viewer** — tap any thumbnail to open the full-size photo, scaled to fit your screen.
4. **The viewer uses the whole window.** A photo grows to fill the space available rather than sitting in a small box with empty room around it.
5. **Videos play in the viewer**, with the usual play, pause, seek, and volume controls.
6. **Zoom in on a photo** with the on-screen `+` / `−` buttons, the scroll wheel, a pinch on a touchscreen, or a double-tap. **Drag to move around** once you're zoomed in, and press **Fit** to snap back to the whole picture. Zoom is for photos; videos keep their own controls instead.
7. **Forward and back controls**, which stop at the first and last item rather than looping.
8. **Keyboard support** in the viewer: left and right arrows to move, Escape to close, `+` and `−` to zoom, `0` to fit. While a video has focus the arrow keys scrub it instead, so playback isn't interrupted.
9. **A position counter** (`3 / 24`) so you know where you are.
10. **The next and previous photos are loaded in advance**, so paging through feels instant. Videos are left alone, so a large file is never fetched just because you passed by it.
11. **Closing the viewer returns you to exactly where you were** in the grid.

## 6. Downloading

1. **Download the photo or video you're looking at** with one button in the fullscreen viewer.
2. **Download a selection** — enter Select mode, tick what you want, and get them all as a single `.zip`.
3. **Download a whole memory** as one `.zip`, in the order it's displayed.
4. **The zip is named after the memory** — `Beach Trip - (14 Jul 2026).zip` — and the files inside are numbered so they stay in order and never overwrite each other.
5. **What you get:** for a photo, the optimized copy the app stored — the camera original was discarded at upload, so there's nothing else to give you. For a video, the exact file you uploaded.
6. **Progress is shown while it's being prepared**, counting off files as they're collected.
7. **Very large downloads are refused** rather than silently failing — over 300 items or about 500 MB, and you're asked to select fewer and take them in batches.
8. **Anyone with a public link can download too**, using the same controls.

## 7. Tidying up

1. **Delete a single photo or video** from a memory, with confirmation.
2. **Select several and delete them together** — enter Select mode, tick the ones you want (or Select all), and remove them in one go.
3. **Deleting anything removes the stored files too**, so nothing is left behind taking up space.

## 8. Sharing with people

1. **Share a memory with another person by email address.**
2. **Two levels of access:** *Can view*, or *Can add photos*.
3. **They get an email** telling them the memory has been shared with them.
4. **See everyone a memory is shared with**, change someone's access level, or remove their access entirely.
5. **"Shared with me"** is its own tab, separate from your own memories, so shared albums never clutter your list.
6. **Only the owner can rename, re-date, or delete a memory** — no matter who else has access.

## 9. Public links

1. **Every memory has a private-by-default public link.** Turn it on to let anyone open the album without an account; turn it off and the link stops working immediately.
2. **Copy the link** to the clipboard in one click.
3. **Regenerate the link** if it's gone somewhere you didn't intend — the old one dies instantly.
4. **What a visitor sees:** the memory's title, its date, the grid, the fullscreen viewer, and the download controls. Nothing else — not your other memories, not your account, and no way to change anything.

## 10. Letting guests add photos

1. **Optionally allow anyone with the public link to add photos** to that one memory — useful for collecting everyone's pictures after an event without asking them all to sign up.
2. **Off by default**, and switched on per memory, never globally.
3. **Guests can only add photos.** Not videos, and they still can't edit or delete anything, including their own uploads.
4. **Guest uploads aren't attributed to anyone**, and only you, the owner, can remove them.
5. **Uploads are rate-limited** so a link that spreads further than you meant can't be used to flood your album.

## 11. Your account

1. **See your profile** — display name, email address, and when you joined.
2. **Change your display name.**
3. **Change your password**, confirming the current one first.
4. **Image optimization is shown as permanently on** and can't be switched off.

## 12. Admin

1. **An admin console** listing every account, with counts of active accounts, deactivated accounts, and memories.
2. **Deactivate an account** to sign it out immediately and block it from signing back in; their memories and photos are left untouched. Reactivate at any time.
3. **Maintenance mode** freezes the whole app: everyone can still browse and download, but nothing can be created, changed, or deleted, and a banner explains why.

---

## 13. Known gaps

Small things the requirements ask for that aren't in the app today. These are gaps in delivered work, **not** the same as the deferred items in [Future-Functionalities.md](Future-Functionalities.md).

| Gap | Detail |
|---|---|
| **Uploading a custom cover image** (`FR-MEM-10`) | You can pick a cover from photos already in the memory, but you can't upload a separate image just to be the cover. The database and the cleanup logic already support it — there's simply no way to upload one. |
| **In-app share notification** (`FR-SHARE-6`) | Sharing sends an email. There's no in-app notification or inbox. |
| **Storage CORS is a deployment step** (`FR-DL-5`) | Downloading reads files straight from storage, which the storage bucket has to be told to allow. It's a one-off command (`npm run storage:cors`) per bucket, and until it's run, downloads fail while everything else works. |

---

*End of current features.*
