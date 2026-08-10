"use client";

import { useActionState } from "react";

import { forgotPasswordAction } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initial);

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

      <SubmitButton pendingLabel="Sending code…" className="big full mt-1">
        Send code
      </SubmitButton>
    </form>
  );
}
