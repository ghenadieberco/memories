import { Shield } from "lucide-react";

import { MaintenanceToggle, UserRow } from "./admin-controls";
import { adminStats, isMaintenanceMode, listUsers, requireAdmin } from "@/lib/admin";

export const metadata = { title: "Admin · Memories" };
export const dynamic = "force-dynamic";

/**
 * Admin console (D22).
 *
 * `requireAdmin()` redirects non-admins to /memories rather than showing a
 * "forbidden" page — there's no reason to tell someone this exists.
 */
export default async function AdminPage() {
  const admin = await requireAdmin();
  const [users, stats, maintenance] = await Promise.all([
    listUsers(),
    adminStats(),
    isMaintenanceMode(),
  ]);

  const activeCount = users.filter((user) => !user.deactivatedAt).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto flex items-center gap-2.5 font-display text-[30px] font-bold text-ink">
          <Shield size={26} className="text-purple" aria-hidden="true" />
          Admin
        </h1>
      </div>

      <p className="mt-1 text-[13px] text-muted-foreground">
        {activeCount} active {activeCount === 1 ? "account" : "accounts"} ·{" "}
        {users.length - activeCount} deactivated · {stats.memories}{" "}
        {stats.memories === 1 ? "memory" : "memories"}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <MaintenanceToggle enabled={maintenance} />

        <section className="glass rounded-2xl p-[22px]">
          <h2 className="font-display text-[17px] font-semibold text-ink">
            People
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Deactivating an account signs it out of the app immediately and blocks
            it from signing back in. Their memories and photos are left untouched.
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {users.map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === admin.id} />
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
