"use client";

import { t } from "@/lib/i18n";

export default function ArchiveError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6 sm:pt-20">
      <h1 className="t-title max-w-[18ch]">{t.errors.title}</h1>
      <p className="t-reading mt-6 max-w-[34rem] text-ink-2">{t.errors.body}</p>
      <button type="button" onClick={reset} className="mt-10 inline-flex h-12 items-center rounded-full bg-ink px-6 text-paper">
        {t.errors.retry}
      </button>
    </section>
  );
}
