"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { UploadError, uploadAudio } from "@/lib/upload";

export const audioAccept = "audio/*,video/mp4,video/webm,.m4a,.mp3,.ogg,.opus,.oga,.wav,.webm,.aac,.amr,.flac,.3gp";
const audioName = /\.(m4a|mp3|ogg|opus|oga|wav|webm|aac|amr|flac|3gp|mp4)$/i;

export function useImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!(file.type.startsWith("audio/") || file.type.startsWith("video/") || audioName.test(file.name))) {
      setError(`${t.record.errors.unreadable.title}. ${t.record.errors.unreadable.body}`);
      return;
    }
    setProgress(0);
    try {
      const { id } = await uploadAudio(file, {
        source: "imported",
        filename: file.name,
        recordedAt: file.lastModified ? new Date(file.lastModified) : new Date(),
        onProgress: setProgress,
      });
      router.push(`/recordings/${id}`);
    } catch (failure) {
      setProgress(null);
      const reason = failure instanceof UploadError && failure.status >= 400 && failure.status < 500 ? `${failure.message} ` : "";
      setError(`${reason}${t.record.errors.unreadable.title}. ${t.record.errors.unreadable.body}`);
    }
  };

  return { inputRef, progress, error, onChange, pick: () => inputRef.current?.click() };
}

export function ImportButton({ className = "", hint = true, label = t.home.importLabel }: { className?: string; hint?: boolean; label?: string }) {
  const inputId = useId();
  const { inputRef, progress, error, onChange } = useImport();

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={audioAccept}
        onChange={onChange}
        disabled={progress !== null}
        className="peer visually-hidden"
      />
      <label
        htmlFor={inputId}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-sm text-[1.0625rem] text-ink underline decoration-rule-2 underline-offset-[0.3em] transition-colors hover:decoration-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-[var(--focus)] peer-disabled:cursor-default"
      >
        {progress !== null ? `${t.record.importing} · ${Math.round(progress * 100)}%` : label}
      </label>
      {hint && progress === null && !error && <p className="t-small text-ink-2">{t.home.importHint}</p>}
      <p role="status" className="t-small max-w-[28rem] text-error">
        {error ?? ""}
      </p>
    </div>
  );
}
