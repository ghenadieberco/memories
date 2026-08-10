import Link from "next/link";

import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Memories" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const justReset = params.reset === "1";

  return (
    <>
      <h1 className="font-display text-[19px] font-semibold text-ink">
        Welcome back
      </h1>
      <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
        Sign in to see your memories.
      </p>

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
