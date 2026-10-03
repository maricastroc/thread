"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ImportIcon, PlusIcon } from "@/components/icons";
import { audioAccept, useImport } from "@/components/ImportButton";
import { t } from "@/lib/i18n";

type Props = {
  subject: string;
  align?: "end" | "start";
  className?: string;
};

export function AddStory({ subject, align = "end", className = "" }: Props) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean) => setOpenAt(value ? pathname : null);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLAnchorElement>(null);
  const { inputRef, progress, error, onChange, pick } = useImport();
  const importing = progress !== null;

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpenAt(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenAt(null);
      trigger.current?.focus();
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpenAt(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-ink pr-5 pl-4 text-[0.9375rem] font-medium whitespace-nowrap text-paper transition-[background-color,transform] duration-150 hover:bg-[color-mix(in_oklab,var(--text),var(--canvas)_16%)] active:scale-[0.98]"
      >
        <PlusIcon size={15} className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
        {t.add.button}
      </button>
      <input ref={inputRef} type="file" accept={audioAccept} onChange={onChange} disabled={importing} tabIndex={-1} aria-hidden="true" className="hidden" />
      <div
        id={panelId}
        role="group"
        aria-label={t.add.title(subject)}
        hidden={!open}
        className={`absolute top-full z-40 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-rule bg-paper-raised p-2 shadow-[0_18px_48px_-24px_rgb(0_0_0/0.45)] ${align === "end" ? "right-0" : "left-0"}`}
      >
        <p className="px-3 pt-2 pb-1.5 text-[0.875rem] text-ink-2">{t.add.title(subject)}</p>
        <Link ref={first} href="/record" className="group flex items-start gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-ink/[0.05]">
          <span aria-hidden="true" className="mt-[0.3rem] flex size-4 shrink-0 items-center justify-center">
            <span className="size-2.5 rounded-full bg-voice" />
          </span>
          <span className="min-w-0">
            <span className="block text-[1.0625rem] leading-snug text-ink">{t.add.record}</span>
            <span className="block text-[0.875rem] leading-snug text-ink-2">{t.add.recordHint}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={pick}
          disabled={importing}
          className="flex w-full items-start gap-3.5 rounded-xl px-3 py-3 text-left transition-colors hover:bg-ink/[0.05] disabled:cursor-default"
        >
          <span aria-hidden="true" className="mt-[0.3rem] flex size-4 shrink-0 items-center justify-center text-ink">
            <ImportIcon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[1.0625rem] leading-snug text-ink">{importing ? `${t.record.importing} · ${Math.round(progress * 100)}%` : t.add.import}</span>
            <span className="block text-[0.875rem] leading-snug text-ink-2">{t.add.importHint}</span>
          </span>
        </button>
        <p role="status" className="px-3 text-[0.875rem] text-error empty:hidden">
          {error ?? ""}
        </p>
      </div>
    </div>
  );
}
