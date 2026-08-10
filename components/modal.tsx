"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/*
 * Modal — style guide §6.
 * Overlay rgba(44,26,74,.32) + blur(6px); glass panel, max-width 440, radius 26,
 * max-height 88vh with its own scroll.
 */
export function Modal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // Move focus into the dialog so keyboard and screen-reader users land here
    // rather than continuing from wherever the page was (style guide §9).
    panelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(44,26,74,.32)", backdropFilter: "blur(6px)" }}
      onMouseDown={(event) => {
        // Only dismiss on a click that both starts and ends on the backdrop —
        // otherwise dragging to select text inside the panel closes it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass w-full max-w-[440px] rounded-[26px] p-[22px] outline-none"
        style={{ maxHeight: "88vh", overflow: "auto" }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          {icon}
          <h2 className="mr-auto font-display text-[19px] font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn ghost sm"
            aria-label="Close"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
