import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";
import { getSessionUser } from "@/lib/profile";

export const metadata = { title: "Sign in · Memories" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const justReset = params.reset === "1";
  const deactivated = params.deactivated === "1";

  /*
   * FR-AUTH-10 — someone who already has a session has nothing to sign in to,
   * so send them where signing in would have sent them.
   *
   * Not when `deactivated=1`: that redirect comes from `requireProfile()` for an
   * account whose Neon Auth session is still valid (D22), so bouncing it back to
   * /memories would ping-pong instead of showing the explanation.
   */
  if (!deactivated && (await getSessionUser())) redirect("/memories");

  return (
    <>
      <h1 className="font-display text-[19px] font-semibold text-ink">
        Welcome back
      </h1>
      <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
        Sign in to see your memories.
      </p>

      {deactivated && (
        <p className="form-error mt-4" role="alert">
          This account has been deactivated. Contact the administrator if you
          think that&apos;s a mistake.
        </p>
      )}

      {justReset && (
        <p className="form-note mt-4" role="status">
          Password updated. Sign in with your new one.
        </p>
      )}

      <SignInForm />

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        New here?{" "}
        <Link href="/sign-up" className="font-bold text-purple">
          Create an account
        </Link>
      </p>
    </>
  );
}
