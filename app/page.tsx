import { CheckCircle2, XCircle } from "lucide-react";

import { Wordmark } from "@/components/wordmark";
import { databaseRoundTrip, storageRoundTrip, type CheckResult } from "@/lib/health";

/*
 * Phase 0 landing page.
 *
 * Two jobs: prove the glass/orb style system renders, and show whether the
 * Neon + Tigris round trips pass. Phase 1 replaces this with the real
 * sign-in / sign-up screen.
 */

export const dynamic = "force-dynamic";

export default async function Page() {
  const checks = await Promise.all([databaseRoundTrip(), storageRoundTrip()]);
  const allOk = checks.every((c) => c.ok);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-[22px] py-[26px]">
      <div className="w-full max-w-[520px] flex flex-col items-center gap-7">
        <Wordmark size="hero" />

        <p className="text-center text-[14.5px] text-muted-foreground max-w-[380px]">
          Little albums for days worth keeping.
        </p>

        <section className="glass w-full rounded-[26px] p-[22px]">
          <h1 className="font-display text-[19px] font-semibold text-ink">
            Phase 0 — foundation
          </h1>
          <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
            {allOk
              ? "Everything is wired up. Ready for Phase 1."
              : "Finish the setup steps below to turn these green."}
          </p>

          <ul className="mt-4 flex flex-col gap-2.5">
            {checks.map((check) => (
              <CheckRow key={check.name} check={check} />
            ))}
          </ul>
        </section>

        <p className="text-center text-[12.5px] text-muted-foreground">
          Next up: authentication and accounts.
        </p>
      </div>
    </main>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  const Icon = check.ok ? CheckCircle2 : XCircle;

  return (
    <li className="flex items-start gap-2.5 rounded-[13px] bg-white/60 p-3">
      <Icon
        size={17}
        aria-hidden="true"
        className={check.ok ? "mt-px text-purple" : "mt-px text-orange-d"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[14.5px] font-semibold text-ink">
            {check.name}
          </span>
          <span className="text-[12.5px] font-semibold text-muted-foreground">
            {check.ok ? "connected" : "not ready"}
          </span>
        </div>
        {/* min-w-0 above + break-words here: long driver errors must wrap, not
            overflow the panel (style guide §11). */}
        <p className="mt-0.5 break-words text-[12.5px] text-muted-foreground">
          {check.detail}
        </p>
      </div>
    </li>
  );
}
