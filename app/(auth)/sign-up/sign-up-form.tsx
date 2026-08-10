"use client";

import { useActionState } from "react";

import { signUpAction } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { PasswordField } from "@/components/password-field";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initial);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3.5">
      <FormMessage state={state} />

      <Field
        label="Your name"
        name="name"
        autoComplete="name"
        placeholder="Alex Rivera"
        required
        error={state.fieldErrors?.name}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        error={state.fieldErrors?.email}
      />
      <PasswordField
        label="Password"
        name="password"
        error={state.fieldErrors?.password}
      />

      <SubmitButton pendingLabel="Creating account…" className="big full mt-1">
        Create account
      </SubmitButton>

      <p className="text-center text-[12.5px] text-muted-foreground">
        We&apos;ll email you a 6-digit code to confirm your address.
      </p>
    </form>
  );
}
