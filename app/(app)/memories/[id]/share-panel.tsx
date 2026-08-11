"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, Link2, Lock, RefreshCw, Share2, Users, X } from "lucide-react";

import {
  regeneratePublicLinkAction,
  revokeShareAction,
  shareMemoryAction,
  togglePublicContributeAction,
  togglePublicLinkAction,
  updatePermissionAction,
} from "../share-actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Modal } from "@/components/modal";
import type { ShareMember } from "@/lib/sharing";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

/*
 * Owner-only sharing panel (FR-SHARE-1..4, 7, 10).
 *
 * Roles are named by what people can do, not by the DB enum (style guide §10):
 * "Can view" / "Can add photos and videos" — the latter says both since D25,
 * because a contributor was never restricted to photos and the shorter label
 * quietly understated the permission being granted.
 */
export function SharePanel({
  memoryId,
  members,
  publicUrl,
  publicLinkActive,
  publicCanContribute,
}: {
  memoryId: string;
  members: ShareMember[];
  publicUrl: string;
  publicLinkActive: boolean;
  publicCanContribute: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction] = useActionState(shareMemoryAction, initial);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<FormState>, fields: Record<string, string>) {
    startTransition(async () => {
      const body = new FormData();
      body.append("memoryId", memoryId);
      for (const [key, value] of Object.entries(fields)) body.append(key, value);
      const result = await action(body);
      setPanelError(result.error ?? null);
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setPanelError("Couldn't copy — select the link and copy it manually.");
    }
  }

  return (
    <>
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        <Share2 size={15} aria-hidden="true" />
        Share
      </button>

      {open && (
        <Modal
          title="Share this memory"
          icon={<Users size={17} className="text-purple" aria-hidden="true" />}
          onClose={() => setOpen(false)}
        >
          {panelError && (
            <p className="form-error mb-3" role="alert">
              {panelError}
            </p>
          )}

          {/* --- Invite someone (FR-SHARE-1/2) --- */}
          <form action={formAction} className="flex flex-col gap-3">
            <FormMessage state={state} />
            <input type="hidden" name="memoryId" value={memoryId} />

            <Field
              label="Invite by email"
              name="email"
              type="email"
              placeholder="them@example.com"
              required
              error={state.fieldErrors?.email}
              hint="They don't need an account yet — it'll be waiting when they sign up."
            />

            {/* Stacked, not crammed across one row (style guide §6 Modal). */}
            <div>
              <label className="lbl" htmlFor="permission">
                They can
              </label>
              <select
                id="permission"
                name="permission"
                className="field"
                defaultValue="viewer"
              >
                <option value="viewer">Can view</option>
                <option value="contributor">Can add photos and videos</option>
              </select>
            </div>

            <SubmitButton pendingLabel="Sending invite…" className="full">
              Send invite
            </SubmitButton>
          </form>

          {/* --- Current members (FR-SHARE-4) --- */}
          {members.length > 0 && (
            <div className="mt-6">
              <p className="seg-h text-[13px] font-extrabold tracking-wide text-purple uppercase">
                Shared with
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-2 rounded-[13px] bg-white/60 p-2.5"
                  >
                    <span
                      className="grid size-[30px] shrink-0 place-items-center rounded-full font-display text-[13px] font-semibold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--purple), var(--orange))",
                      }}
                      aria-hidden="true"
                    >
                      {member.displayName.trim()[0]?.toUpperCase() ?? "?"}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                      {member.displayName}
                      {member.status === "pending" && (
                        <span className="ml-1.5 text-[12px] font-semibold text-muted-foreground">
                          invited
                        </span>
                      )}
                    </span>

                    <select
                      aria-label={`Permission for ${member.displayName}`}
                      className="field w-auto py-1.5 text-[13px]"
                      defaultValue={member.permission}
                      onChange={(event) =>
                        run(updatePermissionAction, {
                          shareId: member.id,
                          permission: event.target.value,
                        })
                      }
                    >
                      <option value="viewer">Can view</option>
                      <option value="contributor">Can add photos and videos</option>
                    </select>

                    <button
                      type="button"
                      className="btn danger sm"
                      aria-label={`Remove ${member.displayName}`}
                      onClick={() => run(revokeShareAction, { shareId: member.id })}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* --- Public link (FR-SHARE-7/10, NFR-PRIV §5.5) --- */}
          <div className="mt-6">
            <p className="seg-h text-[13px] font-extrabold tracking-wide text-purple uppercase">
              Public link
            </p>

            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              Anyone with this link can view the album without signing in. It&apos;s
              unlisted, not private — treat it like handing out a key.
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <div className="in-icon flex min-w-0 flex-1 items-center gap-2 rounded-[13px] border border-[rgba(122,47,242,.14)] bg-white/70 px-3 py-2">
                <Link2 size={15} className="shrink-0 text-purple" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {publicUrl}
                </span>
              </div>
              <button
                type="button"
                className="btn ghost sm"
                onClick={copyLink}
                disabled={!publicLinkActive}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/*
              D21 — the one control in the app that opens an unauthenticated
              write path. Off by default, and the copy says plainly what it
              means rather than hiding behind "allow contributions".
            */}
            <label
              className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-[13px] bg-white/60 p-3"
              style={{ opacity: publicLinkActive ? 1 : 0.5 }}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--purple)]"
                checked={publicCanContribute}
                disabled={!publicLinkActive}
                onChange={(event) =>
                  run(togglePublicContributeAction, {
                    allow: event.target.checked ? "true" : "false",
                  })
                }
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-ink">
                  Let anyone with the link add photos and videos
                </span>
                {/*
                  FR-QUOTA-2 / D26: the second clause used to stop at "won't be
                  attributed to anyone", which is true of authorship and
                  misleading about cost — whatever a guest adds counts against
                  THIS owner's storage. Saying so is the point of the toggle's
                  warning, not a footnote to it.
                */}
                <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                  They won&apos;t need an account, and their uploads won&apos;t be
                  attributed to anyone — but they count against your storage.
                  Only turn this on for a link you&apos;re happy for strangers to
                  receive.
                </span>
              </span>
            </label>

            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn ghost sm"
                onClick={() =>
                  run(togglePublicLinkAction, {
                    active: publicLinkActive ? "false" : "true",
                  })
                }
              >
                <Lock size={15} aria-hidden="true" />
                {publicLinkActive ? "Turn link off" : "Turn link on"}
              </button>

              <button
                type="button"
                className="btn ghost sm"
                onClick={() => run(regeneratePublicLinkAction, {})}
                title="Anyone holding the old link loses access"
              >
                <RefreshCw size={15} aria-hidden="true" />
                New link
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
