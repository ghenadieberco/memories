"use server";

import { redirect } from "next/navigation";

import { auth, neonAuthPost } from "@/lib/auth/server";
import { assertWritable } from "@/lib/admin";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFormState,
  updateNameSchema,
  verifyEmailSchema,
  type FormState,
} from "@/lib/validation";

/*
 * Auth server actions.
 *
 * Every one validates with Zod before touching Neon Auth (plan §10). Neon Auth
 * owns hashing, sessions, verification, reset, and lockout — none of that is
 * reimplemented here (FR-AUTH-4..9).
 *
 * Verification uses 6-digit codes rather than links (D15), because Neon Auth's
 * shared email sender supports codes without a custom domain.
 */

/**
 * Configuration and transport failures. These are OUR problem, never the
 * user's, and must never be reported as a credential error.
 *
 * This list exists because of a real incident: Neon Auth returned
 * `INVALID_ORIGIN` (the app's origin was missing from its trusted domains) and
 * an over-broad `/invalid/` match rewrote it as "That email and password don't
 * match." Every auth call was failing while the message sent everyone hunting
 * for a password problem. Match on `code` first — message text is not an API.
 */
const CONFIG_ERROR_CODES = new Set([
  "INVALID_ORIGIN",
  "MISSING_ORIGIN",
  "NETWORK_ERROR",
  "NETWORK_DNS",
  "NETWORK_REFUSED",
  "NETWORK_TIMEOUT",
  "NETWORK_TLS",
  "NETWORK_RESET",
  "NETWORK_ABORT",
]);

/**
 * Pull `code` and `message` out of a Neon Auth error.
 *
 * Deliberately defensive about shape. The first version of this read only
 * `error.message` at the top level; the SDK nests it, so nothing ever matched
 * and EVERY failure fell through to the caller's fallback text. That made an
 * `INVALID_ORIGIN` config error read as "That email and password don't match"
 * on sign-in and "That code isn't right" on password reset — two different
 * wrong diagnoses for one cause. Check the plausible shapes, and log the raw
 * object so the next unknown shape is visible instead of silent.
 */
function errorParts(error: unknown): { code: string; message: string } {
  if (typeof error !== "object" || error === null) return { code: "", message: "" };

  const seen = new Set<unknown>();
  let code = "";
  let message = "";

  const visit = (value: unknown, depth: number): void => {
    if (depth > 3 || typeof value !== "object" || value === null) return;
    if (seen.has(value)) return;
    seen.add(value);

    const record = value as Record<string, unknown>;
    if (!code && typeof record.code === "string") code = record.code;
    if (!message && typeof record.message === "string") message = record.message;
    if (!message && typeof record.statusText === "string") {
      message = record.statusText;
    }

    for (const key of ["error", "body", "data", "cause", "response"]) {
      if (record[key]) visit(record[key], depth + 1);
    }
  };

  visit(error, 0);
  return { code, message };
}

/** Best-effort serialisation for logs; never sent to the browser. */
function describeError(error: unknown): string {
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(Object(error))).slice(
      0,
      600,
    );
  } catch {
    return String(error);
  }
}

/**
 * Turn a Neon Auth error into a message safe to show a user.
 *
 * Always logs the real code and message server-side: swallowing them entirely
 * is what made the INVALID_ORIGIN incident above so hard to diagnose. Never
 * echoes raw upstream text to the browser, which could leak whether an account
 * exists.
 */
function authError(error: unknown, fallback: string, context: string): string {
  const { code, message } = errorParts(error);
  console.error(
    `[auth:${context}] code=${code || "?"} message=${message || "?"} raw=${describeError(error)}`,
  );

  if (CONFIG_ERROR_CODES.has(code)) {
    return "Sign-in is temporarily unavailable. This is a problem on our side, not with your account.";
  }

  switch (code) {
    case "USER_ALREADY_EXISTS":
      return "An account with that email already exists. Sign in instead.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match.";
    case "EMAIL_NOT_VERIFIED":
      return "Confirm your email first — we sent you a code.";
    case "INVALID_OTP":
    case "INVALID_TOKEN":
      return "That code isn't right. Check and retry.";
    case "OTP_EXPIRED":
    case "TOKEN_EXPIRED":
      return "That code has expired. Send a new one.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters.";
    case "TOO_MANY_REQUESTS":
      return "Too many attempts. Wait a moment and try again.";
    default:
      break;
  }

  // Message-text fallbacks, deliberately narrow. Anything ambiguous — notably
  // the bare word "invalid" — falls through to the caller's own wording so a
  // sign-up failure can never be described as a sign-in failure.
  if (/already exists/i.test(message)) {
    return "An account with that email already exists. Sign in instead.";
  }
  if (/expired/i.test(message)) {
    return "That code has expired. Send a new one.";
  }
  if (/too many|rate limit/i.test(message)) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return fallback;
}

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { name, email, password } = parsed.data;

  const { error } = await auth.signUp.email({ email, password, name });
  if (error) {
    return { error: authError(error, "We couldn't create your account.", "sign-up") };
  }

  // "Verify at Sign-up" is on, so the account exists but is unverified (D4).
  // Send the code and hand off to the verify screen.
  await auth.emailOtp.sendVerificationOtp({
    email,
    type: "email-verification",
  });

  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { email, password } = parsed.data;

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    // An unverified account can't sign in — route to verification rather than
    // leaving the user stuck on a generic failure. Keyed on the structured code
    // where possible; the text check is only a fallback.
    const { code, message } = errorParts(error);
    if (code === "EMAIL_NOT_VERIFIED" || /not verified/i.test(message)) {
      await auth.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      redirect(`/verify?email=${encodeURIComponent(email)}&unverified=1`);
    }
    return { error: authError(error, "That email and password don't match.", "sign-in") };
  }

  // FR-AUTH-10: straight to Memories.
  redirect("/memories");
}

export async function verifyEmailAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = verifyEmailSchema.safeParse({
    email: formData.get("email"),
    otp: formData.get("otp"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { email, otp } = parsed.data;

  const { error } = await auth.emailOtp.verifyEmail({ email, otp });
  if (error) {
    return {
      error: authError(
        error,
        "That confirmation code isn't right. Check it, or send a new one.",
        "verify-email",
      ),
    };
  }

  redirect("/memories");
}

export async function resendVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  await auth.emailOtp.sendVerificationOtp({
    email: parsed.data.email,
    type: "email-verification",
  });

  return { notice: "We sent a new code. It expires shortly." };
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { email } = parsed.data;

  /*
   * The user-visible outcome is identical whether or not the address has an
   * account — telling them would turn this form into an account-enumeration
   * oracle (NFR-SEC).
   *
   * But silent to the USER is not the same as silent to US. An earlier version
   * swallowed everything, so when the send was failing with INVALID_ORIGIN the
   * app still cheerfully redirected to "enter your code" for a code that was
   * never sent. Always log the failure.
   */
  try {
    const { error } = await auth.emailOtp.sendVerificationOtp({
      email,
      type: "forget-password",
    });
    if (error) {
      const { code, message } = errorParts(error);
      console.error(
        `[auth:forgot-password] send failed code=${code || "?"} message=${message || "?"} raw=${describeError(error)}`,
      );
    }
  } catch (thrown) {
    console.error(`[auth:forgot-password] send threw ${describeError(thrown)}`);
  }

  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    email: formData.get("email"),
    otp: formData.get("otp"),
    password: formData.get("password"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { email, otp, password } = parsed.data;

  /*
   * Direct call, not `auth.emailOtp.resetPassword` — the beta SDK declares that
   * method at `email-otp/passcode`, which 404s. See neonAuthPost.
   */
  const { error } = await neonAuthPost("email-otp/reset-password", {
    email,
    otp,
    password,
  });
  if (error) {
    return {
      error: authError(
        error,
        "That reset code isn't right. Request a new one and use the newest email.",
        "reset-password",
      ),
    };
  }

  redirect("/sign-in?reset=1");
}

// --- Settings (FR-PROF-2, FR-PROF-3) ---------------------------------------

export async function updateNameAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { getSessionUser } = await import("@/lib/profile");
  const sessionUser = await getSessionUser();
  try {
    await assertWritable(sessionUser?.id ?? null);
  } catch {
    return { error: "The app is in maintenance mode. Changes are paused." };
  }
  const parsed = updateNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return toFormState(parsed.error);

  const { error } = await auth.updateUser({ name: parsed.data.name });
  if (error) {
    return { error: authError(error, "We couldn't update your name.", "update-name") };
  }

  // profiles.display_name mirrors the auth record; keep them in step.
  const { syncProfileName } = await import("@/lib/profile");
  await syncProfileName(parsed.data.name);

  return { notice: "Name updated." };
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { getSessionUser } = await import("@/lib/profile");
  const sessionUser = await getSessionUser();
  try {
    await assertWritable(sessionUser?.id ?? null);
  } catch {
    return { error: "The app is in maintenance mode. Changes are paused." };
  }
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { error } = await auth.changePassword({
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });
  if (error) {
    return {
      error: authError(error, "Your current password isn't right.", "change-password"),
    };
  }

  return { notice: "Password updated." };
}
