import {
  Download,
  HardDrive,
  Images,
  Link2,
  Lock,
  Search,
  Share2,
  Sparkles,
  UserPlus,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/*
 * The feature cards on the landing page (FR-LAND-4/5).
 *
 * ORDER IS THE SPEC, not a preference. FR-LAND-5 says these run by magnitude —
 * what costs real money or real engineering first — so the 20 GB allowance
 * leads and the conveniences trail. Adding a card means deciding where it
 * honestly ranks, not appending it to the end.
 *
 * Everything here is static copy (FR-LAND-10). This module must never import
 * the database or read a session: the landing page is unauthenticated, and
 * keeping it factless is what keeps it outside the access model entirely.
 *
 * Every claim below is real and shipped — see Current-Features.md. A landing
 * page that promises something the app doesn't do is a bug in the product, not
 * just the copy.
 */

export type LandingFeature = {
  /** Stable id — used for React keys and the carousel's dot controls. */
  id: string;
  icon: LucideIcon;
  /** Short, concrete, sentence case (style guide §10). */
  title: string;
  body: string;
  /** Optional short flag for the one or two cards worth calling out. */
  badge?: string;
};

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "storage",
    icon: HardDrive,
    title: "20 GB of storage, included",
    body: "Every account gets 20 GB for photos and videos — across your own albums and every one you share. No add-ons, no upsell, and a meter in the header so you always know where you stand.",
    badge: "Included",
  },
  {
    id: "video",
    icon: Video,
    title: "Videos, not just photos",
    body: "Drop videos into the same album, from the same button, and they sit right beside the pictures. Up to 100 MB each, kept exactly as you filmed them.",
  },
  {
    id: "optimize",
    icon: Sparkles,
    title: "Every photo optimized automatically",
    body: "Uploads are resized, converted, and thumbnailed the moment they arrive — iPhone HEIC included. Your 20 GB stretches to tens of thousands of photos without you touching a setting.",
  },
  {
    id: "share",
    icon: Share2,
    title: "Share albums with the people in them",
    body: "Invite someone by email — even before they have an account. Choose whether they can just look, or add their own photos and videos to the album.",
  },
  {
    id: "guests",
    icon: UserPlus,
    title: "Let guests add their photos",
    body: "Switch on contributions for one album and anyone with the link can add what they shot, no sign-up required. Perfect for collecting everyone's pictures after a wedding or a birthday.",
  },
  {
    id: "links",
    icon: Link2,
    title: "Public links you can take back",
    body: "Send an album to anyone with a private, unguessable link that needs no account to open. Change your mind and revoke it — the link dies immediately.",
  },
  {
    id: "download",
    icon: Download,
    title: "Download it all as a zip",
    body: "One photo, a handful, or an entire album — packaged up and saved to your device in a click. Your pictures are always yours to take with you.",
  },
  {
    id: "viewer",
    icon: Search,
    title: "A viewer that fills the screen",
    body: "Open any photo full-screen and it uses the whole window. Zoom in with a scroll, a pinch, or a double-tap, then pan around to find the detail you were looking for.",
  },
  {
    id: "privacy",
    icon: Lock,
    title: "Private by default, GPS stripped",
    body: "Nothing is visible to anyone until you share it. The location buried in your camera data is removed before the photo is ever stored — the date is kept, so albums still sort themselves.",
  },
  {
    id: "albums",
    icon: Images,
    title: "A day at a time",
    body: "Give a day a title and a date, and it becomes a little album with its own cover. Photos order themselves by when they were taken, so the story reads the right way round.",
  },
];
