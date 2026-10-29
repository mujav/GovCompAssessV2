"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./ui";

/** Side panel on the native <dialog>: focus trap, Escape and backdrop close come with it. */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-[min(580px,100vw)] max-w-none border-0 border-l border-line bg-white p-0 text-ink backdrop:bg-[#0B1F18]/40"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              {eyebrow && <div className="text-xs text-muted">{eyebrow}</div>}
              <h2 className="m-0 text-lg leading-7 font-semibold">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-lg border border-field bg-white text-lg leading-none text-ink hover:bg-surface-2"
            >
              ×
            </button>
          </div>
          <div className="flex min-h-0 flex-auto flex-col gap-4 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Anchored panel that closes on outside click or Escape. Render it inside a `relative` wrapper. */
export function Popover({
  open,
  onClose,
  children,
  className,
  align = "right",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const wrap = ref.current?.parentElement;
      if (wrap && !wrap.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cx(
        "absolute top-[calc(100%+6px)] z-20 flex flex-col rounded-xl border border-line bg-white shadow-[0_12px_32px_rgba(11,31,24,0.14)]",
        align === "right" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
