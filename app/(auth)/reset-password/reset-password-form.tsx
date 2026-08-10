"use client";

import { useActionState } from "react";

import { resetPasswordAction } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initial);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3.5">
      <FormMessage state={state} />

      <input type="hidden" name="email" value={email} />

      <Field
        label="Verification code"
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={6}
        required
        error={state.fieldErrors?.otp}
      />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        required
        hint="At least 8 characters, with a letter and a number."
        error={state.fieldErrors?.password}
      />

      <SubmitButton pendingLabel="Updating password…" className="big full mt-1">
        Update password
      </SubmitButton>
    </form>
  );
}
