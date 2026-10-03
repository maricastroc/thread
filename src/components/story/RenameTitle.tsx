"use client";

import { useRef, useState, useTransition } from "react";
import { renameStoryAction } from "@/app/actions";
import { t } from "@/lib/i18n";

export function RenameTitle({ storyId, title, titleBy, language }: { storyId: string; title: string; titleBy: "archive" | "family"; language: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [pending, start] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  if (!editing) {
    return (
      <>
        <h1 className="t-title max-w-[22ch]" lang={language ?? undefined}>
          {title}
        </h1>
        <p className="t-small mt-3 text-ink-2">
          {titleBy === "archive" && <span>{t.story.titleByArchive} · </span>}
          <button
            ref={trigger}
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-8 rounded-sm underline decoration-rule-2 underline-offset-[0.25em] hover:text-ink hover:decoration-ink"
          >
            {t.story.rename}
          </button>
        </p>
      </>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await renameStoryAction(storyId, value);
          if (result.ok) close();
        });
      }}
    >
      <label htmlFor="story-title" className="visually-hidden">
        {t.story.renameLabel}
      </label>
      <textarea
        id="story-title"
        value={value}
        rows={2}
        autoFocus
        lang={language ?? undefined}
        onChange={(e) => setValue(e.target.value.replace(/\n/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue(title);
            close();
          }
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        className="t-title block w-full max-w-[22ch] resize-none border-0 border-b border-ink bg-transparent p-0 focus:outline-none"
      />
      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={pending || !value.trim()} className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-paper disabled:opacity-50">
          {t.story.save}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(title);
            close();
          }}
          className="inline-flex h-11 items-center rounded-full border border-rule-2 px-5 hover:border-ink"
        >
          {t.story.cancel}
        </button>
      </div>
    </form>
  );
}
