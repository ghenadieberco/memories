import { MaintenanceBanner } from "@/components/maintenance-banner";
import { TopBar } from "@/components/top-bar";
import { isAdmin, isMaintenanceMode } from "@/lib/admin";
import { requireProfile } from "@/lib/profile";

/*
 * Authenticated shell.
 *
 * proxy.ts already redirects signed-out visitors, so reaching here means a
 * session exists. `requireProfile` additionally guarantees the `profiles` row
 * exists, so every page and query below can assume it (plan §8, Phase 1).
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireProfile();
  const [admin, maintenance] = await Promise.all([
    isAdmin(user.id),
    isMaintenanceMode(),
  ]);

  return (
    <>
      {maintenance && <MaintenanceBanner isAdmin={admin} />}
      <TopBar name={user.name || user.email} isAdmin={admin} />
      <main className="flex-1 px-[22px] py-[26px]">
        <div className="mx-auto max-w-[1100px]">{children}</div>
      </main>
    </>
  );
}
