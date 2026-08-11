"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { LANDING_FEATURES } from "@/lib/landing-features";

/*
 * The landing page's coverflow carousel (FR-LAND-4/6/7/8/9).
 *
 * Coverflow, not a ring: the centre card faces the viewer squarely and stays
 * fully readable, while its neighbours rotate away in 3D. A card nobody can
 * read is decoration, and these cards are the argument for using the app.
 *
 * The three rules that make it not-annoying, all of them requirements:
 *   - it pauses when you hover or focus it (FR-LAND-6), so the card you are
 *     reading cannot slide out from under you;
 *   - it works with the rotation off (FR-LAND-7) — arrows, dots, keyboard;
 *   - it obeys prefers-reduced-motion (FR-LAND-8) by dropping the auto-advance
 *     and the transition, while staying entirely usable by hand. Reduced
 *     motion removes the movement, never the feature.
 */

/** Slow enough to read a card, brisk enough that the page feels alive. */
const ROTATE_MS = 5000;

/** Cards further than this from the centre aren't rendered — see below. */
const VISIBLE_SPREAD = 2;

/*
 * The content is imported here rather than passed in as a prop, and that is a
 * correctness requirement, not a preference: each feature carries a Lucide
 * icon, which is a React *component function*, and functions cannot cross the
 * server→client boundary as props. Passing them compiles and builds cleanly,
 * then fails at request time with "Functions cannot be passed directly to
 * Client Components". Importing the module from inside the client bundle keeps
 * the icons where they can be rendered, and keeps each feature's copy and icon
 * defined together in one place.
 */
export function FeatureCarousel() {
  const features = LANDING_FEATURES;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = features.length;

  /*
   * Read the motion preference on the client and keep listening: someone can
   * change it in the OS while the page is open, and a carousel that keeps
   * spinning after they ask it to stop is exactly the failure the media query
   * exists to prevent.
   */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const go = useCallback(
    (delta: number) => setActive((current) => (current + delta + count) % count),
    [count],
  );

  useEffect(() => {
    if (paused || reducedMotion || count < 2) return;

    const timer = window.setInterval(() => go(1), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, count, go]);

  /*
   * Shortest signed distance from the active card, wrapping around the ends —
   * so stepping from the last card to the first slides forward by one rather
   * than racing backwards through the whole set.
   */
  const offsetOf = (index: number) => {
    const raw = index - active;
    const half = count / 2;
    if (raw > half) return raw - count;
    if (raw < -half) return raw + count;
    return raw;
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="What Memories does"
      className="w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Focus anywhere inside pauses too (FR-LAND-6) — a keyboard user reading
      // a card is as much "reading it" as a mouse user hovering one.
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(1);
        }
      }}
    >
      <div
        // Fixed height, sized to the longest card's copy: every card is the
        // same size in a coverflow, and a container that resized per card
        // would make the controls below it jump on every rotation.
        className="relative h-[318px] w-full sm:h-[286px]"
        style={{ perspective: "1100px" }}
      >
        {features.map((feature, index) => {
          const offset = offsetOf(index);
          const distance = Math.abs(offset);
          const isActive = offset === 0;

          /*
           * Only the centre card and its immediate neighbours are mounted.
           * Rendering all ten would stack eight invisible cards behind the
           * front one, each still costing layout and a blurred glass surface.
           */
          if (distance > VISIBLE_SPREAD) return null;

          return (
            <article
              key={feature.id}
              aria-hidden={!isActive}
              // Off-centre cards are decorative here: their content is
              // announced when they reach the middle, so leaving them in the
              // tab order would mean tabbing through unreadable, rotated text.
              inert={!isActive || undefined}
              className="glass absolute top-0 left-1/2 flex h-full w-[280px] flex-col overflow-hidden rounded-[26px] p-[22px] sm:w-[330px]"
              style={{
                // The 3D itself. translateZ pushes neighbours back, rotateY
                // turns them away, and the scale keeps the centre dominant.
                transform: `translateX(-50%) translateX(${offset * 72}%) translateZ(${
                  distance * -240
                }px) rotateY(${offset * -42}deg) scale(${1 - distance * 0.08})`,
                // Nearer cards must paint over farther ones.
                zIndex: VISIBLE_SPREAD - distance,
                /*
                 * The centre card is deliberately MORE opaque than the style
                 * guide's 55% glass. That recipe assumes glass over ambient
                 * light; here cards overlap each other, and at 55% the card
                 * behind shows straight through the one in front, so two
                 * features' text renders on top of each other. Neighbours keep
                 * the translucency — they are the "light behind" now.
                 */
                background: isActive
                  ? "rgba(255,255,255,0.9)"
                  : "rgba(255,255,255,0.5)",
                opacity: 1 - distance * 0.38,
                // Receding cards blur slightly, which reads as depth and stops
                // their text competing for attention with the centre card's.
                filter: isActive ? "none" : `blur(${distance * 1.6}px)`,
                transition: reducedMotion
                  ? "none"
                  : "transform .55s cubic-bezier(.22,.61,.36,1), opacity .55s ease, filter .55s ease",
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              <div className="flex items-center gap-2.5">
                <feature.icon
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-purple"
                  strokeWidth={2}
                />
                {feature.badge && (
                  <span className="rounded-full bg-[rgba(255,138,61,0.16)] px-2.5 py-1 font-sans text-[11.5px] font-bold text-orange-d">
                    {feature.badge}
                  </span>
                )}
              </div>

              <h3 className="mt-3.5 font-display text-[19px] leading-tight font-semibold text-ink">
                {feature.title}
              </h3>
              <p className="mt-2 font-sans text-[13.5px] leading-relaxed text-ink/80">
                {feature.body}
              </p>
            </article>
          );
        })}
      </div>

      {/*
        A live region carrying only the centre card. The cards themselves move
        for visual reasons; this is what actually gets announced, and it is why
        the rotated ones are inert above.
      */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`${active + 1} of ${count}: ${features[active].title}. ${features[active].body}`}
      </p>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => go(-1)}
          aria-label="Previous feature"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-1.5">
          {features.map((feature, index) => {
            const isActive = index === active;
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => setActive(index)}
                aria-label={feature.title}
                aria-current={isActive}
                className="rounded-full transition-all duration-150"
                style={{
                  // A wide pill for the current card, dots for the rest —
                  // position is legible at a glance without a counter.
                  width: isActive ? 22 : 8,
                  height: 8,
                  background: isActive
                    ? "var(--purple)"
                    : "rgba(122,47,242,0.22)",
                }}
              />
            );
          })}
        </div>

        <button
          type="button"
          className="btn ghost sm"
          onClick={() => go(1)}
          aria-label="Next feature"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
