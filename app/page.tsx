import Link from "next/link";
import { redirect } from "next/navigation";

import { FeatureCarousel } from "@/components/landing/feature-carousel";
import { Wordmark } from "@/components/wordmark";
import { getSessionUser } from "@/lib/profile";

/*
 * The landing page (FR-LAND-*, D27).
 *
 * The root is still a router for anyone signed in — they get their Memories,
 * exactly as before (FR-AUTH-10) — but for everyone else it is now the app's
 * front door rather than a bounce to the sign-in form.
 *
 * NOTHING BELOW READS USER DATA (FR-LAND-10). The only session call is the
 * redirect check; the page's content is static copy from `lib/landing-features`.
 * That is deliberate: this is an unauthenticated route, and a page with no
 * facts about anybody cannot leak one.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Memories — little albums for days worth keeping",
  description:
    "Organize your photos and videos into albums for the days you want to keep, and share them with the people who were there. 20 GB included.",
};

export default async function Page() {
  if (await getSessionUser()) redirect("/memories");

  return (
    <main className="flex-1 px-[22px] py-[26px]">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center">
        {/* The one bold element on the screen — style guide §11. */}
        <Wordmark size="hero" />

        <h1 className="mt-7 max-w-[620px] text-center font-display text-[30px] leading-tight font-bold text-ink sm:text-[38px]">
          Little albums for days worth keeping
        </h1>

        <p className="mt-3.5 max-w-[520px] text-center font-sans text-[15px] leading-relaxed text-ink/75">
          Gather the photos and videos from a day that mattered, give it a name,
          and keep it somewhere good. Share it with the people who were there —
          and let them add the shots you missed.
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          <Link href="/sign-up" className="btn primary">
            Create memories
          </Link>
          <p className="font-sans text-[13px] text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-bold text-purple">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-12 w-full sm:mt-14">
          <FeatureCarousel />
        </div>

        <p className="mt-12 text-center font-sans text-[12.5px] text-muted-foreground">
          Your albums are private until you share them.
        </p>
      </div>
    </main>
  );
}
