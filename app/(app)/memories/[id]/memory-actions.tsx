"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
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
  const [coverError, setCoverError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stopEditing = useCallback(() => setEditing(false), []);

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
          onClose={stopEditing}
        >
          <EditMemoryForm
            memoryId={memoryId}
            title={title}
            memoryDate={memoryDate}
            onSaved={stopEditing}
          />
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

/**
 * FR-MEM-6 — the edit form. It lives in its own component, mounted only while
 * the dialog is open, for two reasons: a successful save closes the dialog, and
 * the next open then starts from a clean FormState rather than greeting the
 * user with the last save's notice. Errors keep the dialog open so they stay
 * readable next to the fields they belong to.
 */
function EditMemoryForm({
  memoryId,
  title,
  memoryDate,
  onSaved,
}: {
  memoryId: string;
  title: string;
  memoryDate: string;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState(updateMemoryAction, initial);

  useEffect(() => {
    if (state.notice) onSaved();
  }, [state, onSaved]);

  return (
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
  );
}
