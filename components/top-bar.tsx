import Link from "next/link";
import { LogOut, Settings as SettingsIcon } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/wordmark";

/*
 * Authenticated top bar — style guide §6 (glass bar, radius 22) and §6 Avatar
 * (circle, purple→orange gradient, white Fredoka initial).
 *
 * The gradient here and on the settings toggle are the only two places the
 * purple→orange gradient is allowed (style guide §2, §11).
 */

export function TopBar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <header className="px-[22px] pt-[22px]">
      <div className="glass mx-auto flex max-w-[1100px] items-center gap-3 rounded-[22px] px-4 py-3">
        <Link href="/memories" aria-label="Memories home" className="mr-auto">
          <Wordmark size="nav" />
        </Link>

        <Link
          href="/settings"
          className="btn ghost sm"
          aria-label="Profile and settings"
        >
          <SettingsIcon size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Settings</span>
        </Link>

        <form action={signOutAction}>
          <button type="submit" className="btn ghost sm" aria-label="Sign out">
            <LogOut size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>

        <span
          className="grid size-10 shrink-0 place-items-center rounded-full font-display text-[16px] font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, var(--purple), var(--orange))",
          }}
          aria-hidden="true"
        >
          {initial}
        </span>
      </div>
    </header>
  );
}
