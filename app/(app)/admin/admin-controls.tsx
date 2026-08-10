"use client";

import { useState, useTransition } from "react";
import { Ban, CheckCircle2, ShieldAlert } from "lucide-react";

import { setMaintenanceModeAction, setUserActiveAction } from "./actions";
import type { AdminUser } from "@/lib/admin";
import type { FormState } from "@/lib/validation";

/*
 * Admin console controls (D22).
 *
 * Presentation only — every action re-checks `requireAdmin()` server-side, so
 * nothing here grants anything.
 */

export function MaintenanceToggle({ enabled }: { enabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    startTransition(async () => {
      const body = new FormData();
      body.append("enabled", next ? "true" : "false");
      const result: FormState = await setMaintenanceModeAction(body);
      setError(result.error ?? null);
      setNotice(result.notice ?? null);
    });
  }

  return (
    <section className="glass rounded-2xl p-[22px]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
            <ShieldAlert size={17} className="text-orange" aria-hidden="true" />
            Maintenance mode
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Freezes the app for everyone: no uploads, edits, deletes, shares, or
            settings changes, and a banner appears on every page. Viewing still
            works. Admins are exempt so you can switch it back off.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Maintenance mode"
          disabled={pending}
          onClick={() => toggle(!enabled)}
          className="relative block h-[29px] w-[50px] shrink-0 rounded-[20px] transition-opacity disabled:opacity-50"
          style={{
            background: enabled
              ? "linear-gradient(135deg, var(--purple), var(--orange))"
              : "#D9CFE6",
          }}
        >
          <span
            className="absolute top-[3px] size-[23px] rounded-full bg-white shadow-sm transition-all"
            style={{ left: enabled ? "24px" : "3px" }}
          />
        </button>
      </div>

      {error && (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="form-note mt-3" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

export function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const active = !user.deactivatedAt;

  function toggleActive() {
    startTransition(async () => {
      const body = new FormData();
      body.append("userId", user.id);
      body.append("active", active ? "false" : "true");
      const result = await setUserActiveAction(body);
      setError(result.error ?? null);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[13px] bg-white/60 p-3">
      <span
        className="grid size-[34px] shrink-0 place-items-center rounded-full font-display text-[14px] font-semibold text-white"
        style={{
          background: active
            ? "linear-gradient(135deg, var(--purple), var(--orange))"
            : "#B3A8C4",
        }}
        aria-hidden="true"
      >
        {user.displayName.trim()[0]?.toUpperCase() ?? "?"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-ink">
          {user.displayName}
          {user.role === "admin" && (
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: "rgba(122,47,242,.12)", color: "var(--purple-d)" }}
            >
              admin
            </span>
          )}
          {!active && (
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: "rgba(255,138,61,.16)", color: "var(--orange-d)" }}
            >
              deactivated
            </span>
          )}
        </p>
        <p className="truncate text-[12.5px] text-muted-foreground">
          {user.email} · {user.memoryCount}{" "}
          {user.memoryCount === 1 ? "memory" : "memories"}
          {!user.emailVerified && " · unverified"}
        </p>
        {error && (
          <p className="mt-1 text-[12.5px] font-semibold text-orange-d" role="alert">
            {error}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={toggleActive}
        disabled={pending || isSelf}
        className={`btn sm ${active ? "danger" : "ghost"}`}
        title={isSelf ? "You can't deactivate your own account" : undefined}
      >
        {active ? (
          <>
            <Ban size={15} aria-hidden="true" />
            Deactivate
          </>
        ) : (
          <>
            <CheckCircle2 size={15} aria-hidden="true" />
            Reactivate
          </>
        )}
      </button>
    </li>
  );
}
