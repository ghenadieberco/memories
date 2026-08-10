"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initial);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3.5">
      <FormMessage state={state} />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Your password"
        required
        error={state.fieldErrors?.password}
      />

      <SubmitButton pendingLabel="Signing in…" className="big full mt-1">
        Sign in
      </SubmitButton>

      <Link
        href="/forgot-password"
        className="text-center text-[12.5px] font-semibold text-muted-foreground hover:text-purple"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
