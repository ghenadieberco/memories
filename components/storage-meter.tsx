import { HardDrive } from "lucide-react";

import { formatBytes } from "@/lib/format";
import type { StorageUsage } from "@/lib/storage-quota";

/*
 * Storage Used vs Total, in the top bar on every authenticated page
 * (FR-QUOTA-7/8; style guide §3 typography, §6 bar).
 *
 * Server-rendered from the layout's own query — no client component, no fetch,
 * no polling. It is a figure that changes when the user uploads or deletes, and
 * both of those already re-render the page.
 *
 * The number shown is the OWNER's usage (FR-QUOTA-2 / D26): what this user's
 * own memories hold, including whatever contributors and guests added to them.
 * That is why the label says "storage" rather than "your uploads" — the two are
 * not the same thing, and the difference is the whole design.
 *
 * Two variants, because FR-QUOTA-7's "degrade gracefully on narrow screens"
 * has two answers now: `bar` is the compact form that sits in the wide top bar,
 * `menu` is the roomy form inside the narrow-screen header menu (style guide
 * §6 Header menu). Only the width and whether the figures show differ.
 */

/** Purple until it matters, orange when it does — the accent's job (§2). */
function toneFor(usage: StorageUsage) {
  if (usage.isFull) {
    return {
      fill: "linear-gradient(90deg, var(--orange), var(--orange-d))",
      text: "var(--orange-d)",
    };
  }
  if (usage.isNearFull) {
    return {
      fill: "linear-gradient(90deg, var(--purple-l), var(--orange))",
      text: "var(--orange-d)",
    };
  }
  return {
    fill: "linear-gradient(90deg, var(--purple), var(--purple-d))",
    text: "var(--muted-ink)",
  };
}

export function StorageMeter({
  usage,
  variant = "bar",
}: {
  usage: StorageUsage;
  /** `bar` = compact, in the wide top bar. `menu` = full width, in the menu. */
  variant?: "bar" | "menu";
}) {
  const inMenu = variant === "menu";
  const tone = toneFor(usage);
  const used = formatBytes(usage.usedBytes);
  const total = formatBytes(usage.quotaBytes);
  const percent = Math.round(usage.ratio * 100);

  /*
   * One sentence carrying the whole state, for anyone who can't see the bar
   * (NFR-UX / style guide §10). The visible figures are decorative once this
   * exists, hence aria-hidden below.
   */
  const label = usage.isFull
    ? `Storage full: ${used} of ${total} used. Delete something to upload more.`
    : `Storage: ${used} of ${total} used, ${formatBytes(usage.remainingBytes)} free.`;

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${inMenu ? "w-full" : ""}`}
      role="group"
      aria-label={label}
      title={label}
    >
      <HardDrive
        size={15}
        aria-hidden="true"
        style={{ color: tone.text }}
        className="shrink-0"
      />

      <div
        className={`flex min-w-0 flex-col gap-1 ${inMenu ? "flex-1" : ""}`}
        aria-hidden="true"
      >
        {/*
          The figures are the first thing to go when width is scarce, and in the
          `bar` variant they go below 640px — but the bar itself stays, so a
          quota filling up is still visible and the near-full colour still lands
          (FR-QUOTA-8). In the `menu` variant there is width to spare, so they
          always show. Either way the full reading is on the group's own label.
        */}
        <span
          className={`font-sans text-[12.5px] font-semibold leading-none whitespace-nowrap ${
            inMenu ? "block" : "hidden sm:block"
          }`}
          style={{ color: tone.text }}
        >
          {used} <span style={{ color: "var(--muted-ink)" }}>/ {total}</span>
        </span>

        {/*
          In the bar, a fixed width rather than a flexible one: the meter sits
          in a row with a wordmark, up to three buttons and an avatar, and one
          that grows with the viewport pushes them around at every width. 84px
          is enough to read a fill level and small enough to never be the reason
          the bar wraps. In the menu the panel sets the width, so it fills it.
        */}
        <span
          className={`block h-[5px] overflow-hidden rounded-full bg-[rgba(122,47,242,0.12)] ${
            inMenu ? "w-full" : "w-[84px]"
          }`}
        >
          <span
            className="block h-full rounded-full transition-[width] duration-300"
            style={{
              // Never zero-width once anything is stored: a sliver reading
              // "some" is more honest than an empty bar reading "none".
              width: usage.usedBytes > 0 ? `max(3px, ${percent}%)` : "0%",
              background: tone.fill,
            }}
          />
        </span>
      </div>
    </div>
  );
}
