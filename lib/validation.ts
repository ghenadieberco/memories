import { z } from "zod";

/*
 * Zod schemas for every server boundary (plan §10 — non-negotiable).
 * Messages here are user-facing: active voice, sentence case, and they say what
 * to do rather than apologise (style guide §10).
 */

/**
 * FR-AUTH-3: at least 8 characters, with at least one letter and one number.
 * Neon Auth enforces its own minimum server-side; this is the product rule and
 * the source of the message the user actually reads.
 */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const emailSchema = z
  .string()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80, "Keep your name under 80 characters.");

/** Six-digit verification code (D15 — codes, not links). */
export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your email.");

export const signUpSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  password: passwordSchema,
});

export const updateNameSchema = z.object({
  name: displayNameSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

/** Shape every auth server action returns, for `useActionState`. */
export type FormState = {
  error?: string;
  /** Field-level messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  notice?: string;
};

/** Collapse a ZodError into a FormState without leaking internals. */
export function toFormState(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return { fieldErrors };
}

// --- Memories (FR-MEM-*) ---------------------------------------------------

export const memoryTitleSchema = z
  .string()
  .trim()
  .min(1, "Give this memory a title.")
  .max(120, "Keep the title under 120 characters.");

/** `date` column format. D2: user-set, defaults to today, editable. */
export const memoryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

export const createMemorySchema = z.object({
  title: memoryTitleSchema,
  memoryDate: memoryDateSchema,
});

export const updateMemorySchema = z.object({
  memoryId: z.string().uuid(),
  title: memoryTitleSchema,
  memoryDate: memoryDateSchema,
});

export const memoryIdSchema = z.object({
  memoryId: z.string().uuid(),
});

export const setCoverSchema = z.object({
  memoryId: z.string().uuid(),
  photoId: z.string().uuid(),
});

export const photoIdSchema = z.object({
  photoId: z.string().uuid(),
});

/** Bulk delete. Capped so one request can't try to delete an entire library. */
export const photoIdsSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1, "Select at least one photo.").max(200),
});

// --- Sharing (FR-SHARE-*) --------------------------------------------------

export const permissionSchema = z.enum(["viewer", "contributor"]);

export const shareMemorySchema = z.object({
  memoryId: z.string().uuid(),
  email: emailSchema,
  permission: permissionSchema,
});

export const shareIdSchema = z.object({
  memoryId: z.string().uuid(),
  shareId: z.string().uuid(),
});

export const updatePermissionSchema = z.object({
  memoryId: z.string().uuid(),
  shareId: z.string().uuid(),
  permission: permissionSchema,
});
