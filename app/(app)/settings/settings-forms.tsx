"use client";

import { useActionState } from "react";

import { changePasswordAction, updateNameAction } from "@/app/(auth)/actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { PasswordField } from "@/components/password-field";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

/** FR-PROF-2 — update display name. */
export function DisplayNameForm({ defaultName }: { defaultName: string }) {
  const [state, formAction] = useActionState(updateNameAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Field
        label="Display name"
        name="name"
        autoComplete="name"
        defaultValue={defaultName}
        required
        error={state.fieldErrors?.name}
      />
      <div>
        <SubmitButton pendingLabel="Updating name…">Update name</SubmitButton>
      </div>
    </form>
  );
}

/** FR-PROF-3 — change password, requiring the current one. */
export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <FormMessage state={state} />
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.currentPassword}
      />
      <PasswordField
        label="New password"
        name="newPassword"
        error={state.fieldErrors?.newPassword}
      />
      <div>
        <SubmitButton pendingLabel="Updating password…">
          Update password
        </SubmitButton>
      </div>
    </form>
  );
}
