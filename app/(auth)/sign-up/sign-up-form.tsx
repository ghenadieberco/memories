"use client";

import { useActionState, useState } from "react";

import { signUpAction } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

/**
 * Strength indicator (FR-AUTH-3). Deliberately mirrors the same three rules the
 * server enforces in `passwordSchema` — if those change, change these together.
 */
function strengthOf(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: "" };

  const rules = [
    password.length >= 8,
    /[A-Za-z]/.test(password),
    /[0-9]/.test(password),
  ];
  const met = rules.filter(Boolean).length;
  const bonus = password.length >= 14 ? 1 : 0;
  const score = Math.min(met + bonus, 4);

  if (met < 3) return { score, label: "Keep going" };
  return { score, label: bonus ? "Strong" : "Good" };
}

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initial);
  const [password, setPassword] = useState("");
  const strength = strengthOf(password);

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

      <div>
        <label className="lbl" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="field"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={state.fieldErrors?.password ? true : undefined}
          aria-describedby="password-strength"
        />

        <div id="password-strength" className="mt-2 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{
                  background:
                    i < strength.score
                      ? strength.score >= 3
                        ? "var(--purple)"
                        : "var(--orange)"
                      : "rgba(122,47,242,0.14)",
                }}
              />
            ))}
          </div>
          <span className="text-[12.5px] font-semibold text-muted-foreground">
            {strength.label}
          </span>
        </div>

        {state.fieldErrors?.password && (
          <p className="mt-1.5 text-[12.5px] font-semibold text-orange-d">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <SubmitButton pendingLabel="Creating account…" className="big full mt-1">
        Create account
      </SubmitButton>

      <p className="text-center text-[12.5px] text-muted-foreground">
        We&apos;ll email you a 6-digit code to confirm your address.
      </p>
    </form>
  );
}
