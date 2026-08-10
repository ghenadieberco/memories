import Link from "next/link";

import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create your account · Memories" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="font-display text-[19px] font-semibold text-ink">
        Create your account
      </h1>
      <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
        Little albums for days worth keeping.
      </p>

      <SignUpForm />

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        Already have one?{" "}
        <Link href="/sign-in" className="font-bold text-purple">
          Sign in
        </Link>
      </p>
    </>
  );
}
