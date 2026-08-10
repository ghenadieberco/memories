"use client";

import { useActionState, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { createMemoryAction } from "./actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { todayIsoDate } from "@/lib/format";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

/** FR-MEM-1 — create a memory from a title and a date (D2: defaults to today). */
export function CreateMemoryButton({ variant = "primary" }: { variant?: "primary" | "ghost" }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createMemoryAction, initial);

  return (
    <>
      <button type="button" className={`btn ${variant}`} onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" />
        Create memory
      </button>

      {open && (
        <Modal
          title="Create memory"
          icon={<Sparkles size={17} className="text-purple" aria-hidden="true" />}
          onClose={() => setOpen(false)}
        >
          <form action={formAction} className="flex flex-col gap-3.5">
            <FormMessage state={state} />

            <Field
              label="Title"
              name="title"
              placeholder="Beach weekend"
              required
              error={state.fieldErrors?.title}
            />
            <Field
              label="Date"
              name="memoryDate"
              type="date"
              defaultValue={todayIsoDate()}
              required
              error={state.fieldErrors?.memoryDate}
            />

            <SubmitButton pendingLabel="Creating memory…" className="big full mt-1">
              Create memory
            </SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}
