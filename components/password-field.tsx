"use client";

import { useState } from "react";

/*
 * Password input with a strength indicator.
 *
 * FR-AUTH-3 requires the indicator at registration; it's used on every screen
 * where a new password is chosen (sign-up, reset, change password) because
 * showing the rules in one place and hiding them in another just makes the
 * other two feel broken.
 *
 * The rules below deliberately mirror `passwordSchema` in lib/validation.ts,
 * which is what the server actually enforces. Change them together.
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

export function PasswordField({
  label,
  name,
  autoComplete = "new-password",
  placeholder = "At least 8 characters",
  error,
}: {
  label: string;
  name: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
}) {
  const [password, setPassword] = useState("");
  const strength = strengthOf(password);
  const meterId = `${name}-strength`;
  const errorId = `${name}-error`;

  return (
    <div>
      <label className="lbl" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="field"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : meterId}
      />

      <div id={meterId} className="mt-2 flex items-center gap-2">
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
        {/* Announced politely so screen-reader users get the same signal the
            colour bars give everyone else. */}
        <span
          className="text-[12.5px] font-semibold text-muted-foreground"
          role="status"
        >
          {strength.label}
        </span>
      </div>

      {error && (
        <p id={errorId} className="mt-1.5 text-[12.5px] font-semibold text-orange-d">
          {error}
        </p>
      )}
    </div>
  );
}
