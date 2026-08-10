/*
 * Poster-frame capture, in the uploader's browser — FR-VIDEO-3, D23.
 *
 * THIS IS THE LOAD-BEARING PIECE OF VIDEO SUPPORT. Without a transcoder the
 * server cannot decode a video at all, so it cannot produce a thumbnail and
 * cannot tell a playable file from an unplayable one. The browser can do both,
 * because it is about to be asked to play the thing anyway.
 *
 * So the gate is: a video that yields a poster frame here is a video that plays.
 * One that doesn't is rejected at the point of upload, with the user still
 * looking at the file picker, instead of becoming a broken tile discovered
 * weeks later. That makes this function a validation step that happens to also
 * produce an image, not a nice-to-have.
 *
 * The server still re-checks everything it can (container magic bytes, size,
 * and that the poster really is an image) — this runs on the client, so it is
 * a usability gate, never a security one.
 */

/** Give up rather than hang forever on a file the browser half-understands. */
const DECODE_TIMEOUT_MS = 20_000;

/** Skip the black frame most videos open on, when there's enough to skip. */
const PREFERRED_FRAME_SECONDS = 1;

export class PosterCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PosterCaptureError";
  }
}

/** Does this look like a video we should route to the video path? */
export function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm)$/i.test(file.name)
  );
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new PosterCaptureError(message)), DECODE_TIMEOUT_MS),
    ),
  ]);
}

function once(target: HTMLVideoElement, event: string, failure: string) {
  return new Promise<void>((resolve, reject) => {
    target.addEventListener(event, () => resolve(), { once: true });
    target.addEventListener(
      "error",
      () => reject(new PosterCaptureError(failure)),
      { once: true },
    );
  });
}

/**
 * Decode `file` far enough to grab one frame and its duration.
 *
 * Returns the frame as a JPEG blob — JPEG rather than PNG because this is a
 * photograph-like frame that the server is about to re-encode to WebP anyway,
 * and a lossless PNG of a 4K frame is a pointlessly large thing to upload.
 */
export async function capturePoster(
  file: File,
): Promise<{ poster: Blob; durationSeconds: number | null }> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  // Muted + playsInline keeps mobile browsers willing to decode without a
  // user gesture; the element is never attached to the page or played.
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  const unplayable = "We couldn't read that video. Try an MP4 or WebM file.";

  try {
    await withTimeout(once(video, "loadedmetadata", unplayable), unplayable);

    /*
     * Some WebM files report Infinity until fully buffered. That is not a
     * reason to reject the file — it only means we have no duration to show
     * and must seek from the very start.
     */
    const duration = Number.isFinite(video.duration) ? video.duration : null;

    const target =
      duration && duration > PREFERRED_FRAME_SECONDS * 2 ? PREFERRED_FRAME_SECONDS : 0;

    if (target > 0) {
      const seeked = once(video, "seeked", unplayable);
      video.currentTime = target;
      await withTimeout(seeked, unplayable);
    } else {
      // At currentTime 0 there may still be no decoded frame yet.
      await withTimeout(once(video, "loadeddata", unplayable), unplayable);
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new PosterCaptureError(unplayable);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new PosterCaptureError(unplayable);
    context.drawImage(video, 0, 0, width, height);

    const poster = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!poster) throw new PosterCaptureError(unplayable);

    return { poster, durationSeconds: duration };
  } finally {
    // Release the decoder and the blob URL whether or not this worked; a
    // half-loaded <video> holding a multi-hundred-megabyte file is not
    // something to leave to the garbage collector's timing.
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
