import { Camera } from "lucide-react";

/*
 * The wordmark — style guide §1. Bright-purple `MEMORIES` in a bold rounded
 * display face, with a small orange camera glyph tilted ~-8°.
 *
 * This is usually the one bold element on a screen; keep everything near it
 * quiet.
 */

type WordmarkProps = {
  /** `hero` = 52px landing/auth treatment, `nav` = 24px top bar. */
  size?: "hero" | "nav";
  className?: string;
};

export function Wordmark({ size = "hero", className = "" }: WordmarkProps) {
  const isHero = size === "hero";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Camera
        aria-hidden="true"
        strokeWidth={2}
        className="-rotate-8 text-orange"
        size={isHero ? 40 : 20}
      />
      <span
        className="font-display font-bold tracking-tight text-purple"
        style={{ fontSize: isHero ? 52 : 24, lineHeight: 1.05 }}
      >
        MEMORIES
      </span>
    </div>
  );
}
