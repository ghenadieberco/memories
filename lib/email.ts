import { appEnv } from "@/lib/env";

/*
 * Transactional email (FR-SHARE-6 share notifications).
 *
 * Auth email — verification and password reset — is NOT sent from here. Neon
 * Auth owns that and sends it from its own shared sender (D15).
 *
 * Degrades deliberately: with no RESEND_API_KEY the message is logged and the
 * caller carries on. A share must never fail because email is unconfigured —
 * the share itself is the product behaviour, the email is a courtesy. Until a
 * verified sending domain exists, Resend only delivers to the account owner's
 * own address, so this stays no-op in practice for now.
 */

type Mail = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(mail: Mail): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Memories <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set — would have sent "${mail.subject}" to ${mail.to}`,
    );
    return { sent: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
      }),
    });

    if (!response.ok) {
      console.error(
        `[email] send failed ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("[email] send threw", error);
    return { sent: false };
  }
}

/** Shared house style: cream card, purple accent — style guide §2. */
function layout(body: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;background:#FAF5EC;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;padding:28px">
    <p style="font-size:22px;font-weight:700;color:#7A2FF2;margin:0 0 18px">MEMORIES</p>
    ${body}
  </div>
</div>`;
}

export async function sendShareNotification(options: {
  to: string;
  sharerName: string;
  memoryTitle: string;
  permission: "viewer" | "contributor";
  hasAccount: boolean;
}) {
  const url = `${appEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/${
    options.hasAccount ? "shared" : "sign-up"
  }`;

  // Name the capability by what the person can do, not the DB enum
  // (style guide §10).
  const capability =
    options.permission === "contributor"
      ? "view it and add your own photos"
      : "view it";

  return sendEmail({
    to: options.to,
    subject: `${options.sharerName} shared "${options.memoryTitle}" with you`,
    html: layout(
      `<p style="font-size:15px;color:#2C1A4A;margin:0 0 14px">
         <strong>${options.sharerName}</strong> shared the memory
         <strong>${options.memoryTitle}</strong> with you. You can ${capability}.
       </p>
       ${
         options.hasAccount
           ? ""
           : `<p style="font-size:14px;color:#7C6C92;margin:0 0 14px">
                Create an account with this email address and it'll be waiting for you.
              </p>`
       }
       <a href="${url}" style="display:inline-block;background:#7A2FF2;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:13px">
         ${options.hasAccount ? "Open Memories" : "Create your account"}
       </a>`,
    ),
  });
}
