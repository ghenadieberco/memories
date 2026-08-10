"use client";

import { useState, useTransition } from "react";
import { Tag, X } from "lucide-react";

import { tagPhotoAction, untagAction } from "../tag-actions";
import type { PhotoTag } from "@/lib/people";

/*
 * People tags shown inside the fullscreen viewer (FR-SOC-4/5).
 *
 * Rendered on the dark viewer scrim, so colours here are the light-on-dark
 * variants rather than the standard glass tokens.
 */
export function PhotoTags({
  photoId,
  tags,
  currentUserId,
  isOwner,
  onChanged,
}: {
  photoId: string;
  tags: PhotoTag[];
  currentUserId: string;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addTag() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const body = new FormData();
      body.append("photoId", photoId);
      body.append("name", trimmed);
      const result = await tagPhotoAction(body);
      setError(result.error ?? result.fieldErrors?.name ?? null);
      if (!result.error && !result.fieldErrors) {
        setName("");
        onChanged();
      }
    });
  }

  function removeTag(tagId: string) {
    startTransition(async () => {
      const body = new FormData();
      body.append("tagId", tagId);
      const result = await untagAction(body);
      setError(result.error ?? null);
      if (!result.error) onChanged();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Tag size={14} className="text-white/70" aria-hidden="true" />

        {tags.length === 0 && (
          <span className="text-[12.5px] text-white/60">No one tagged yet</span>
        )}

        {tags.map((tag) => {
          // FR-SOC-5: the tagger, the memory owner, or the tagged person
          // themselves. Everyone must be able to untag themselves.
          const mayRemove =
            tag.taggedBy === currentUserId ||
            isOwner ||
            tag.linkedUserId === currentUserId;

          return (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-white"
              style={{ background: "rgba(255,255,255,.18)" }}
            >
              {tag.name}
              {mayRemove && (
                <button
                  type="button"
                  onClick={() => removeTag(tag.id)}
                  disabled={pending}
                  aria-label={`Remove tag ${tag.name}`}
                  className="opacity-70 hover:opacity-100"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="Tag someone…"
          aria-label="Tag someone in this photo"
          maxLength={80}
          className="min-w-0 flex-1 rounded-[13px] px-3 py-2 text-[13px] text-white placeholder:text-white/50"
          style={{ background: "rgba(255,255,255,.14)" }}
        />
        <button
          type="button"
          onClick={addTag}
          disabled={pending || !name.trim()}
          className="rounded-[13px] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-45"
          style={{ background: "rgba(255,255,255,.22)" }}
        >
          {pending ? "Saving…" : "Tag"}
        </button>
      </div>

      {error && (
        <p className="text-[12.5px] font-semibold text-[#ffcf8a]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
