import { HardDrive } from "lucide-react";

import { formatBytes, type StorageUsage } from "@/lib/storage-quota";

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

export function StorageMeter({ usage }: { usage: StorageUsage }) {
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
      className="flex min-w-0 items-center gap-2"
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

      <div className="flex min-w-0 flex-col gap-1" aria-hidden="true">
        {/*
          FR-QUOTA-7: narrow screens drop the figures, not the meter. The bar
          alone still shows a quota filling up — and the near-full colour still
          lands (FR-QUOTA-8) — which is the part that has to survive on a phone.
          The full reading stays reachable through the group's own label.
        */}
        <span
          className="hidden font-sans text-[12.5px] font-semibold leading-none whitespace-nowrap sm:block"
          style={{ color: tone.text }}
        >
          {used} <span style={{ color: "var(--muted-ink)" }}>/ {total}</span>
        </span>

        {/*
          Fixed width rather than flexible: the bar sits in a row with a
          wordmark, up to three buttons and an avatar, and a meter that grows
          with the viewport pushes them around at every width. 84px is enough
          to read a fill level and small enough to never be the reason the bar
          wraps.
        */}
        <span className="block h-[5px] w-[84px] overflow-hidden rounded-full bg-[rgba(122,47,242,0.12)]">
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
