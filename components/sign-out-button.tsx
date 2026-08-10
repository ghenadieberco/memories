"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { authClient } from "@/lib/auth/client";

/*
 * FR-AUTH-5 — sign out.
 *
 * Goes through the client SDK rather than a server action. The server-action
 * version cleared cookies via next/headers and then redirected, and that
 * combination failed the action round trip ("This page couldn't load") without
 * logging anything server-side. The client SDK posts to our own
 * /api/auth/[...path] proxy, so the session cookie is cleared by an ordinary
 * Set-Cookie response header — the mechanism the SDK is built around.
 *
 * `router.refresh()` after navigating matters: without it the App Router can
 * serve a cached authenticated shell, which looks exactly like sign-out having
 * failed.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await authClient.signOut();
    } catch (error) {
      // Still navigate away: leaving someone on an authenticated-looking page
      // after they asked to leave is the worse failure.
      console.error("Sign out failed", error);
    }
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="btn ghost sm"
      aria-label="Sign out"
    >
      <LogOut size={15} aria-hidden="true" />
      <span className="hidden sm:inline">{busy ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
