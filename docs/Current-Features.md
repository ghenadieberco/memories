# Memories — Current Features

| | |
|---|---|
| **Product** | Memories |
| **Version** | 1.0 |
| **Date** | 10 August 2026 |
| **Status** | Live at <https://memories.ghenadie-berco.com> |
| **Covers** | Everything working in the app today |

---

## 0. About this document

A plain-language catalogue of **what the app can do right now** — written to be read, not implemented from. It is the counterpart to [Future-Functionalities.md](Future-Functionalities.md), which lists what is *deferred* and what is *declined*.

It is descriptive, not authoritative. [Memories-App-Requirements.md](Memories-App-Requirements.md) remains the source of truth for *what* the product should do (and holds the `FR-` IDs), [Memories-Implementation-Plan.md](Memories-Implementation-Plan.md) for *how*, and [UI-Style-Guide.md](UI-Style-Guide.md) for how it looks and reads.

**Keep this current.** As each Future Functionality is built, move it here and remove it from that document in the same change.

---

## 1. Getting in

- **Sign up** with a name, email address, and password.
- **Verify your email** with a 6-digit code sent to your inbox — you enter the code in the app rather than clicking a link.
- **Sign in** and **sign out**.
- **Password rules are enforced as you type**: at least 8 characters with at least one letter and one number, with a live strength meter.
- **Forgot your password?** Request a reset, get a 6-digit code by email, and set a new password.
- If someone shares a memory with an email address that hasn't registered yet, **the invitation is waiting for them the moment they sign up**.

## 2. Your memories

- **Create a memory** by giving it a title and a date.
- Every memory is labelled **`Title - (Date)`** — for example, `Beach Trip - (14 Jul 2026)`.
- **The memories list** shows all of your memories as cards with a cover image and a photo count, **newest date first**.
- **Open a memory** to see its photos.
- **Edit** a memory's title or date at any time.
- **Delete** a memory, with a confirmation step. Its photos and their stored files go with it.
- **Choose a cover image** for a memory by picking any photo already inside it, and **reset the cover** to go back to the automatic choice.
- If you haven't chosen a cover, one is picked for you; an empty memory shows a placeholder.

## 3. Adding photos

- **Upload one or many photos** into a memory at once.
- **JPEG, PNG, WebP, and HEIC** are all accepted — iPhone photos work without converting anything first.
- **Up to 25 MB per file.**
- **Progress is shown while uploading**, and each file succeeds or fails on its own — one bad file doesn't sink the batch.
- **Every photo is optimized automatically.** It's resized, converted to a smaller modern format, and given a thumbnail. There's no setting to fiddle with, and no way to upload an unoptimized file.
- **The date the photo was taken is read from the camera data** and used to order it, then **the rest of that data — including GPS location — is stripped** before the file is stored.
- **Photos are ordered by when they were taken**, falling back to upload time for photos with no camera date.

## 4. Looking at photos

- **A responsive thumbnail grid** that adapts from phone to desktop and loads thumbnails lazily as you scroll.
- **A fullscreen viewer** — tap any thumbnail to open the full-size photo scaled to fit your screen.
- **Forward and back controls**, which stop at the first and last photo rather than looping.
- **Keyboard support** in the viewer: left and right arrows to move, Escape to close.
- **A position counter** (`3 / 24`) so you know where you are.
- **The next and previous photos are loaded in advance**, so paging through feels instant.
- **Closing the viewer returns you to exactly where you were** in the grid.

## 5. Tidying up

- **Delete a single photo** from a memory, with confirmation.
- **Select several photos and delete them together** — enter Select mode, tick the ones you want (or Select all), and remove them in one go.
- **Deleting anything removes the stored image files too**, so nothing is left behind taking up space.

## 6. Sharing with people

- **Share a memory with another person by email address.**
- **Two levels of access:** *Can view*, or *Can add photos*.
- **They get an email** telling them the memory has been shared with them.
- **See everyone a memory is shared with**, change someone's access level, or remove their access entirely.
- **"Shared with me"** is its own tab, separate from your own memories, so shared albums never clutter your list.
- **Only the owner can rename, re-date, or delete a memory** — no matter who else has access.

## 7. Public links

- **Every memory has a private-by-default public link.** Turn it on to let anyone open the album without an account; turn it off and the link stops working immediately.
- **Copy the link** to the clipboard in one click.
- **Regenerate the link** if it's gone somewhere you didn't intend — the old one dies instantly.
- **What a visitor sees:** the memory's title, its date, the photo grid, and the fullscreen viewer. Nothing else — not your other memories, not your account, and no way to change anything.

## 8. Letting guests add photos

- **Optionally allow anyone with the public link to add photos** to that one memory — useful for collecting everyone's pictures after an event without asking them all to sign up.
- **Off by default**, and switched on per memory, never globally.
- **Guests can only add.** They still can't edit or delete anything, including their own uploads.
- **Guest uploads aren't attributed to anyone**, and only you, the owner, can remove them.
- **Uploads are rate-limited** so a link that spreads further than you meant can't be used to flood your album.

## 9. Your account

- **See your profile** — display name, email address, and when you joined.
- **Change your display name.**
- **Change your password**, confirming the current one first.
- **Image optimization is shown as permanently on** and can't be switched off.

## 10. Admin

- **An admin console** listing every account, with counts of active accounts, deactivated accounts, and memories.
- **Deactivate an account** to sign it out immediately and block it from signing back in; their memories and photos are left untouched. Reactivate at any time.
- **Maintenance mode** freezes the whole app: everyone can still browse, but nothing can be created, changed, or deleted, and a banner explains why.

---

## 11. Known gaps

Small things the requirements ask for that aren't in the app today. These are gaps in delivered work, **not** the same as the deferred items in [Future-Functionalities.md](Future-Functionalities.md).

| Gap | Detail |
|---|---|
| **Uploading a custom cover image** (`FR-MEM-10`) | You can pick a cover from photos already in the memory, but you can't upload a separate image just to be the cover. The database and the cleanup logic already support it — there's simply no way to upload one. |
| **In-app share notification** (`FR-SHARE-6`) | Sharing sends an email. There's no in-app notification or inbox. |

---

*End of current features.*
