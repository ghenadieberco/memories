"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Settings as SettingsIcon, Shield, X } from "lucide-react";

import { Avatar } from "@/components/avatar";
import { SignOutButton } from "@/components/sign-out-button";
import { StorageMeter } from "@/components/storage-meter";
import type { StorageUsage } from "@/lib/storage-quota";

/*
 * The narrow-screen top bar (style guide §6 Header menu, §9 responsive).
 *
 * Below 640px the bar's whole action cluster — storage meter, Admin, Settings,
 * Sign out — collapses into this one button. Dropping the labels and keeping
 * the icons in a row was the previous answer, and it does not survive a third
 * action: four controls plus an avatar and a wordmark leaves the meter fighting
 * for the width it needs to be legible at all.
 *
 * This is a disclosure, not an ARIA `menu`. `role="menu"` promises full
 * arrow-key menu semantics; what is inside here is ordinary links and a button,
 * so tab order, `aria-expanded`, and Escape are the right contract (§9).
 */
export function HeaderMenu({
  name,
  isAdmin = false,
  storage,
}: {
  name: string;
  isAdmin?: boolean;
  /** FR-QUOTA-7 — the owner's usage, read once by the layout. */
  storage?: StorageUsage;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  /*
   * Close on navigation. The bar lives in the layout, so it survives the route
   * change a menu link causes — without this the panel would still be hanging
   * open over the new page, and browser Back would leave it there too.
   *
   * Adjusted during render rather than in an effect: this is state derived from
   * a prop change, and doing it in an effect renders the stale open panel first
   * (React's "adjusting state when a prop changes"). The links close themselves
   * as well, for the case where the destination is the page you are already on
   * and the pathname never changes.
   */
  const [menuPathname, setMenuPathname] = useState(pathname);
  if (menuPathname !== pathname) {
    setMenuPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Send focus back where it came from, rather than to the top of the
      // document (style guide §9).
      buttonRef.current?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    // Crossing the breakpoint hands the actions back to the wide bar, which
    // renders its own copy of them. Closing here is what stops a panel opened
    // in portrait from reappearing, still open, when a rotated phone rotates
    // back.
    const wide = window.matchMedia("(min-width: 640px)");
    const onBreakpointChange = () => {
      if (wide.matches) setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    wide.addEventListener("change", onBreakpointChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      wide.removeEventListener("change", onBreakpointChange);
    };
  }, [open]);

  /*
   * FR-QUOTA-8 says running out should be anticipated, not discovered at upload
   * time — and a meter behind a tap cannot do that on its own. The closed
   * button carries the warning instead: an orange dot, and the state spoken in
   * its label.
   */
  const storageWarning = storage?.isFull
    ? "storage full"
    : storage?.isNearFull
      ? "storage nearly full"
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="btn ghost sm relative"
        aria-expanded={open}
        aria-controls="header-menu"
        aria-label={
          open ? "Close menu" : storageWarning ? `Menu — ${storageWarning}` : "Menu"
        }
      >
        {open ? (
          <X size={18} aria-hidden="true" />
        ) : (
          <Menu size={18} aria-hidden="true" />
        )}

        {!open && storageWarning && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white"
            style={{ background: "var(--orange-d)" }}
          />
        )}
      </button>

      {open && (
        <div
          id="header-menu"
          className="menu-panel glass absolute right-0 top-[calc(100%+10px)] z-40 w-[252px] max-w-[calc(100vw-44px)] rounded-xl p-2"
        >
          {/* Who you are — the one thing the narrow bar has no room to say. */}
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Avatar name={name} size="list" />
            <span className="truncate font-display text-[15px] font-semibold text-ink">
              {name}
            </span>
          </div>

          {storage && (
            <div className="px-2 pt-1 pb-2">
              <StorageMeter usage={storage} variant="menu" />
            </div>
          )}

          <div
            className="mx-2 mb-1 h-px"
            style={{ background: "rgba(122,47,242,.12)" }}
          />

          {isAdmin && (
            <Link
              href="/admin"
              className="menu-item"
              onClick={() => setOpen(false)}
            >
              <Shield size={16} aria-hidden="true" />
              Admin
            </Link>
          )}

          <Link
            href="/settings"
            className="menu-item"
            onClick={() => setOpen(false)}
          >
            <SettingsIcon size={16} aria-hidden="true" />
            Settings
          </Link>

          <SignOutButton variant="menu" />
        </div>
      )}
    </div>
  );
}
