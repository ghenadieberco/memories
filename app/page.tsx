import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/profile";

/*
 * Root is a router, not a screen: signed in goes to Memories (FR-AUTH-10),
 * everyone else to sign-in.
 *
 * This replaced the Phase 0 status board. The same round-trip checks still run
 * at /api/health?deep=1.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getSessionUser();
  redirect(user ? "/memories" : "/sign-in");
}
