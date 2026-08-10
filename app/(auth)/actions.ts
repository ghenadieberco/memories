"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
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
 * Neon Auth returns errors as `{ error }` rather than throwing. Turn one into a
 * message safe to show a user: never echo raw upstream text, which can leak
 * whether an account exists.
 */
function authError(error: unknown, fallback: string): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  // Pass through only messages we know are safe and useful.
  if (/invalid|incorrect|credential/i.test(message)) {
    return "That email and password don't match.";
  }
  if (/exists|already/i.test(message)) {
    return "An account with that email already exists.";
  }
  if (/expired/i.test(message)) {
    return "That code has expired. Send a new one.";
  }
  if (/too many|rate/i.test(message)) {
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
    return { error: authError(error, "We couldn't create your account.") };
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
    // leaving the user stuck on a generic failure.
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
    if (/verif/i.test(message)) {
      await auth.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      redirect(`/verify?email=${encodeURIComponent(email)}&unverified=1`);
    }
    return { error: authError(error, "That email and password don't match.") };
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
    return { error: authError(error, "That code isn't right. Check and retry.") };
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

  // Ignore the result deliberately: revealing whether an address has an account
  // turns this form into an account-enumeration oracle (NFR-SEC).
  await auth.emailOtp
    .sendVerificationOtp({ email, type: "forget-password" })
    .catch(() => undefined);

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

  const { error } = await auth.emailOtp.resetPassword({ email, otp, password });
  if (error) {
    return { error: authError(error, "That code isn't right. Check and retry.") };
  }

  redirect("/sign-in?reset=1");
}

export async function signOutAction(): Promise<void> {
  await auth.signOut();
  redirect("/sign-in");
}

// --- Settings (FR-PROF-2, FR-PROF-3) ---------------------------------------

export async function updateNameAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return toFormState(parsed.error);

  const { error } = await auth.updateUser({ name: parsed.data.name });
  if (error) {
    return { error: authError(error, "We couldn't update your name.") };
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
      error: authError(error, "Your current password isn't right."),
    };
  }

  return { notice: "Password updated." };
}
