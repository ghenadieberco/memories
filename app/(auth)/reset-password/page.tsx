import { redirect } from "next/navigation";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Set a new password · Memories" };

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";

  if (!email) redirect("/forgot-password");

  return (
    <>
      <h1 className="font-display text-[19px] font-semibold text-ink">
        Set a new password
      </h1>
      {/*
        Worded so it reveals nothing about whether an account exists — the
        action deliberately doesn't tell us either (NFR-SEC).
      */}
      <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
        If <span className="text-ink">{email}</span> has an account, a 6-digit
        code is on its way.
      </p>

      <ResetPasswordForm email={email} />
    </>
  );
}
