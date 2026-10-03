"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { CloseIcon } from "@/components/icons";
import { t } from "@/lib/i18n";
import { useAudio, useAudioState, useAudioTime } from "./AudioProvider";
import { PlayButton } from "./PlayButton";
import { TimeReadout } from "./TimeReadout";

export function MiniPlayer() {
  const { close } = useAudio();
  const track = useAudioState((s) => s.track);
  const docked = useAudioState((s) => s.docked);
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);

  useAudioTime((time, state) => {
    if (!barRef.current || !state.track) return;
    const span = Math.max(0.1, state.track.end - state.track.start);
    barRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, (time - state.track.start) / span))})`;
  });

  const hidden =
    !track ||
    pathname.startsWith("/record") ||
    (docked !== null && (docked === track.storyId || docked === `recording:${track.recordingId}`));

  if (hidden || !track) return null;

  const href = track.storyId ? `/stories/${track.storyId}` : `/recordings/${track.recordingId}`;

  return (
    <>
      <div aria-hidden="true" className="h-20" />
      <section
        aria-label={t.player.nowPlaying}
        className="animate-rise fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-transparent">
          <div ref={barRef} className="h-full origin-left bg-voice" style={{ transform: "scaleX(0)" }} />
        </div>
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-4 px-4 sm:px-6">
          <PlayButton track={track} size="md" variant="solid" />
          <div className="min-w-0 flex-1">
            <p className="t-small text-ink-2">{t.player.nowPlaying}</p>
            <Link href={href} lang={track.language ?? undefined} className="link block truncate font-serif text-[1.0625rem] leading-snug">
              {track.title}
            </Link>
          </div>
          <TimeReadout track={track} className="hidden sm:inline" />
          <button
            type="button"
            onClick={close}
            aria-label={t.player.close}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>
      </section>
    </>
  );
}
