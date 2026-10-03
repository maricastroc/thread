"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/i18n";

export function RemoveRecording({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const response = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
    setPending(false);
    if (response.ok) {
      router.push("/");
      router.refresh();
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center text-[0.9375rem] text-ink-2 underline decoration-rule-2 underline-offset-[0.3em] hover:text-ink hover:decoration-ink"
      >
        {t.recording.remove}
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-labelledby={`remove-${id}`} className="max-w-[30rem] rounded-lg border border-rule-2 p-4">
      <p id={`remove-${id}`} className="text-[0.9375rem]">
        {t.recording.removeConfirm}
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          autoFocus
          className="inline-flex h-11 items-center rounded-full bg-voice px-5 text-on-voice disabled:opacity-60"
        >
          {t.recording.remove}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-11 items-center rounded-full border border-rule-2 px-5 hover:border-ink">
          {t.story.cancel}
        </button>
      </div>
    </div>
  );
}
