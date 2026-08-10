import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset your password · Memories" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-[19px] font-semibold text-ink">
        Reset your password
      </h1>
      <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
        Enter your email and we&apos;ll send you a code.
      </p>

      <ForgotPasswordForm />

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        <Link href="/sign-in" className="font-bold text-purple">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
