import { ShieldAlert } from "lucide-react";

/*
 * Global maintenance banner (D22).
 *
 * Shown on every page — authenticated and public guest alike — whenever
 * maintenance mode is on. Orange rather than the usual glass: this is the one
 * moment the app should look interrupted rather than calm.
 */
export function MaintenanceBanner({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2.5 px-[22px] py-2.5 text-center text-[13px] font-bold text-white"
      style={{ background: "linear-gradient(135deg, var(--orange-d), var(--orange))" }}
    >
      <ShieldAlert size={16} aria-hidden="true" className="shrink-0" />
      <span>
        Memories is in maintenance mode. You can still look around, but changes
        are paused.
        {isAdmin && " You're an admin, so your changes still go through."}
      </span>
    </div>
  );
}
