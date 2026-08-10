"use client";

import { useFormStatus } from "react-dom";

import type { FormState } from "@/lib/validation";

/*
 * Form primitives for the auth and settings screens.
 * Visuals come from the .field / .lbl / .btn classes in globals.css, which
 * implement style guide §6.
 */

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  inputMode?: "text" | "numeric" | "email";
  maxLength?: number;
  error?: string;
  hint?: string;
};

export function Field({ label, name, error, hint, ...input }: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div>
      <label className="lbl" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...input}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-[12.5px] font-semibold text-orange-d">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Submit button that disables itself while the action runs. Keeps its label
 * through the flow (style guide §10) — the pending text is the same verb.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`btn ${variant} ${className}`}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Top-of-form error or notice. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className="form-error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p className="form-note" role="status">
        {state.notice}
      </p>
    );
  }
  return null;
}
