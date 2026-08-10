"use client";

import { useActionState, useState, useTransition } from "react";
import { Calendar, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { clearCoverAction, deleteMemoryAction, updateMemoryAction } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Modal } from "@/components/modal";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

/** Owner-only controls: edit (FR-MEM-6), reset cover (D11), delete (FR-MEM-7). */
export function MemoryActions({
  memoryId,
  title,
  memoryDate,
  hasCustomCover,
}: {
  memoryId: string;
  title: string;
  memoryDate: string;
  hasCustomCover: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(updateMemoryAction, initial);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Same reason as the cover button in photo-grid: a FormState-returning action
  // can't be a bare form action, and its error must not be silently dropped.
  function resetCover() {
    startTransition(async () => {
      const body = new FormData();
      body.append("memoryId", memoryId);
      const result = await clearCoverAction(body);
      setCoverError(result.error ?? null);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn ghost sm" onClick={() => setEditing(true)}>
        <Pencil size={15} aria-hidden="true" />
        Edit
      </button>

      {hasCustomCover && (
        <button
          type="button"
          onClick={resetCover}
          className="btn ghost sm"
          title="Use the most recent photo"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Reset cover
        </button>
      )}

      {coverError && (
        <p className="form-error" role="alert">
          {coverError}
        </p>
      )}

      <button type="button" className="btn danger sm" onClick={() => setConfirming(true)}>
        <Trash2 size={15} aria-hidden="true" />
        Delete
      </button>

      {editing && (
        <Modal
          title="Edit memory"
          icon={<Calendar size={17} className="text-purple" aria-hidden="true" />}
          onClose={() => setEditing(false)}
        >
          <form action={formAction} className="flex flex-col gap-3.5">
            <FormMessage state={state} />
            <input type="hidden" name="memoryId" value={memoryId} />
            <Field
              label="Title"
              name="title"
              defaultValue={title}
              required
              error={state.fieldErrors?.title}
            />
            <Field
              label="Date"
              name="memoryDate"
              type="date"
              defaultValue={memoryDate}
              required
              error={state.fieldErrors?.memoryDate}
            />
            <SubmitButton pendingLabel="Saving changes…" className="big full mt-1">
              Save changes
            </SubmitButton>
          </form>
        </Modal>
      )}

      {confirming && (
        <Modal
          title="Delete this memory?"
          icon={<Trash2 size={17} className="text-orange-d" aria-hidden="true" />}
          onClose={() => setConfirming(false)}
        >
          {/* FR-MEM-7 requires a confirmation, and the copy has to be honest
              about the photos going too — this is not undoable. */}
          <p className="text-[14px] text-ink">
            <span className="font-bold">{title}</span> and every photo in it will
            be deleted for good. This can&apos;t be undone.
          </p>
          <form action={deleteMemoryAction} className="mt-5 flex gap-2">
            <input type="hidden" name="memoryId" value={memoryId} />
            <button
              type="button"
              className="btn ghost full"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </button>
            <SubmitButton pendingLabel="Deleting…" variant="danger" className="full">
              Delete memory
            </SubmitButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
