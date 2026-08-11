import Link from "next/link";
import { Settings as SettingsIcon, Shield } from "lucide-react";

import { Avatar } from "@/components/avatar";
import { HeaderMenu } from "@/components/header-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { StorageMeter } from "@/components/storage-meter";
import { Wordmark } from "@/components/wordmark";
import type { StorageUsage } from "@/lib/storage-quota";

/*
 * Authenticated top bar — style guide §6 (glass bar, radius 22).
 *
 * Two layouts around one breakpoint (style guide §9): above 640px the actions
 * lay out across the bar, below it they collapse into the header menu. Both
 * clusters are rendered and one is hidden in CSS, which keeps the bar a server
 * component — only the menu's open/closed state needs the client.
 */

export function TopBar({
  name,
  isAdmin = false,
  storage,
}: {
  name: string;
  isAdmin?: boolean;
  /** FR-QUOTA-7 — the owner's usage, read once by the layout. */
  storage?: StorageUsage;
}) {
  return (
    <header className="px-[22px] pt-[22px]">
      <div className="glass mx-auto flex max-w-[1100px] items-center gap-3 rounded-xl px-4 py-3">
        <Link href="/memories" aria-label="Memories home" className="mr-auto">
          <Wordmark size="nav" />
        </Link>

        <div className="hidden items-center gap-3 sm:flex">
          {storage && <StorageMeter usage={storage} />}

          {isAdmin && (
            <Link href="/admin" className="btn ghost sm" aria-label="Admin console">
              <Shield size={15} aria-hidden="true" />
              <span>Admin</span>
            </Link>
          )}

          <Link
            href="/settings"
            className="btn ghost sm"
            aria-label="Profile and settings"
          >
            <SettingsIcon size={15} aria-hidden="true" />
            <span>Settings</span>
          </Link>

          <SignOutButton />

          <Avatar name={name} />
        </div>

        <div className="sm:hidden">
          <HeaderMenu name={name} isAdmin={isAdmin} storage={storage} />
        </div>
      </div>
    </header>
  );
}
