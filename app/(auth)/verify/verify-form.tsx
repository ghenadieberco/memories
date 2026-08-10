"use client";

import { useActionState } from "react";

import { resendVerificationAction, verifyEmailAction } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

export function VerifyForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(verifyEmailAction, initial);
  const [resendState, resendAction] = useActionState(
    resendVerificationAction,
    initial,
  );

  return (
    <>
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

        <SubmitButton pendingLabel="Confirming…" className="big full mt-1">
          Confirm email
        </SubmitButton>
      </form>

      {/* Separate form: resending must not submit the code field. */}
      <form action={resendAction} className="mt-3">
        <FormMessage state={resendState} />
        <input type="hidden" name="email" value={email} />
        <SubmitButton
          pendingLabel="Sending…"
          variant="ghost"
          className="sm full mt-2"
        >
          Send a new code
        </SubmitButton>
      </form>
    </>
  );
}
