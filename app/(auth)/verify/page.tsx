import { redirect } from "next/navigation";

import { VerifyForm } from "./verify-form";

export const metadata = { title: "Confirm your email · Memories" };

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const wasUnverified = params.unverified === "1";

  // Nothing to verify without an address — send them back to start.
  if (!email) redirect("/sign-up");

  return (
    <>
      <h1 className="font-display text-[19px] font-semibold text-ink">
        Confirm your email
      </h1>
      <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
        We sent a 6-digit code to <span className="text-ink">{email}</span>.
      </p>

      {wasUnverified && (
        <p className="form-note mt-4" role="status">
          Confirm your email before signing in. We sent you a fresh code.
        </p>
      )}

      <VerifyForm email={email} />
    </>
  );
}
