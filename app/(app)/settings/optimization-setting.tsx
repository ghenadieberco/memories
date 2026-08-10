import { Sparkles } from "lucide-react";

/*
 * FR-PROF-4 / NFR-OPT — image optimization is shown ON and is NOT editable.
 *
 * Rendered as a disabled toggle that keeps the "on" look at full opacity with a
 * default cursor (style guide §6 Toggle). It is presentational only: there is no
 * input and no action, so there is no request a user could forge to turn it off.
 * The purple→orange gradient is allowed here — this toggle and the avatar are
 * its only two homes.
 */
export function OptimizationSetting() {
  return (
    <section className="glass rounded-[26px] p-[22px]">
      <h2 className="font-display text-[17px] font-semibold text-ink">
        Photos
      </h2>

      <div className="mt-4 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-orange" aria-hidden="true" />
            <span className="text-[14.5px] font-semibold text-ink">
              Image optimization
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Every photo you upload is resized and compressed automatically, and
            a thumbnail is made for the grid. This stays on.
          </p>
        </div>

        <span
          role="img"
          aria-label="Image optimization is on and cannot be turned off"
          className="relative block h-[29px] w-[50px] shrink-0 cursor-default rounded-[20px]"
          style={{
            background:
              "linear-gradient(135deg, var(--purple), var(--orange))",
          }}
        >
          <span className="absolute top-[3px] left-[24px] size-[23px] rounded-full bg-white shadow-sm" />
        </span>
      </div>
    </section>
  );
}
