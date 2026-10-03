"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

export type Track = {
  recordingId: string;
  storyId: string | null;
  title: string;
  start: number;
  end: number;
  language?: string | null;
};

export type AudioState = {
  track: Track | null;
  playing: boolean;
  loading: boolean;
  time: number;
  ended: boolean;
  error: boolean;
  docked: string | null;
};

const initial: AudioState = { track: null, playing: false, loading: false, time: 0, ended: false, error: false, docked: null };

type Store = {
  get: () => AudioState;
  set: (patch: Partial<AudioState>) => void;
  subscribe: (listener: () => void) => () => void;
};

function createStore(): Store {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type Controls = {
  store: Store;
  play: (track: Track, from?: number) => void;
  toggle: (track?: Track) => void;
  pause: () => void;
  seek: (time: number) => void;
  close: () => void;
  dock: (key: string | null) => void;
};

const AudioContext = createContext<Controls | null>(null);

export const audioSrc = (recordingId: string) => `/api/recordings/${recordingId}/audio`;

export function AudioProvider({ narrator, children }: { narrator: string | null; children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const store = useMemo(() => createStore(), []);
  const frame = useRef<number | null>(null);
  const pendingSeek = useRef<number | null>(null);

  const tick = useRef<() => void>(() => undefined);
  useEffect(() => {
    tick.current = () => {
      const audio = audioRef.current;
      const { track } = store.get();
      if (!audio || !track) return;
      const time = audio.currentTime;
      if (time >= track.end - 0.04) {
        audio.pause();
        store.set({ time: track.end, playing: false, ended: true });
        return;
      }
      store.set({ time });
      frame.current = requestAnimationFrame(() => tick.current());
    };
  }, [store]);

  const stopTicking = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  const play = useCallback(
    (track: Track, from?: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const start = Math.max(track.start, Math.min(from ?? track.start, track.end - 0.1));
      const src = audioSrc(track.recordingId);
      const current = store.get().track;
      store.set({ track, ended: false, error: false, time: start });
      if (!audio.src.endsWith(src)) {
        audio.src = src;
        pendingSeek.current = start;
        store.set({ loading: true });
      } else if (current?.recordingId === track.recordingId) {
        audio.currentTime = start;
      }
      if (audio.readyState >= 1 && pendingSeek.current === null) audio.currentTime = start;
      void audio.play().catch(() => store.set({ playing: false, loading: false }));
    },
    [store],
  );

  const pause = useCallback(() => audioRef.current?.pause(), []);

  const toggle = useCallback(
    (track?: Track) => {
      const audio = audioRef.current;
      const state = store.get();
      if (!audio) return;
      const same = track && state.track && state.track.recordingId === track.recordingId && state.track.start === track.start && state.track.end === track.end;
      if (track && !same) return play(track);
      if (!state.track) return;
      if (state.playing) audio.pause();
      else if (state.ended) play(state.track, state.track.start);
      else void audio.play().catch(() => undefined);
    },
    [play, store],
  );

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      const { track } = store.get();
      if (!audio || !track) return;
      const clamped = Math.max(track.start, Math.min(time, track.end - 0.05));
      if (audio.readyState >= 1) audio.currentTime = clamped;
      else pendingSeek.current = clamped;
      store.set({ time: clamped, ended: false });
    },
    [store],
  );

  const close = useCallback(() => {
    const audio = audioRef.current;
    audio?.pause();
    store.set({ track: null, playing: false, time: 0, ended: false });
  }, [store]);

  const dock = useCallback((key: string | null) => store.set({ docked: key }), [store]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      store.set({ playing: true, ended: false });
      stopTicking();
      frame.current = requestAnimationFrame(() => tick.current());
    };
    const onPause = () => {
      stopTicking();
      store.set({ playing: false, time: audio.currentTime });
    };
    const onMeta = () => {
      if (pendingSeek.current !== null) {
        audio.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
    };
    const onTime = () => {
      const { track } = store.get();
      if (!track) return;
      if (audio.currentTime >= track.end - 0.04) {
        audio.pause();
        store.set({ time: track.end, playing: false, ended: true });
        return;
      }
      if (Math.abs(store.get().time - audio.currentTime) > 0.2) store.set({ time: audio.currentTime });
    };
    const onWaiting = () => store.set({ loading: true });
    const onPlaying = () => store.set({ loading: false });
    const onError = () => store.set({ error: true, playing: false, loading: false });
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onPlaying);
    audio.addEventListener("error", onError);
    return () => {
      stopTicking();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onPlaying);
      audio.removeEventListener("error", onError);
    };
  }, [store]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    return store.subscribe(() => {
      const { track } = store.get();
      if (!track) return;
      const current = navigator.mediaSession.metadata;
      if (current?.title === track.title) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: narrator ?? "", album: "Thread" });
      navigator.mediaSession.setActionHandler("play", () => toggle());
      navigator.mediaSession.setActionHandler("pause", () => pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => seek(store.get().time - 10));
      navigator.mediaSession.setActionHandler("seekforward", () => seek(store.get().time + 10));
    });
  }, [narrator, pause, seek, store, toggle]);

  const controls = useMemo(() => ({ store, play, toggle, pause, seek, close, dock }), [store, play, toggle, pause, seek, close, dock]);

  return (
    <AudioContext.Provider value={controls}>
      {children}
      <audio ref={audioRef} preload="metadata" className="hidden" />
    </AudioContext.Provider>
  );
}

export function useAudio(): Controls {
  const controls = useContext(AudioContext);
  if (!controls) throw new Error("useAudio must be used inside AudioProvider");
  return controls;
}

export function useAudioState<T>(selector: (state: AudioState) => T): T {
  const { store } = useAudio();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(initial),
  );
}

export function useAudioTime(callback: (time: number, state: AudioState) => void): void {
  const { store } = useAudio();
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    const run = () => ref.current(store.get().time, store.get());
    run();
    return store.subscribe(run);
  }, [store]);
}

export function isSameTrack(a: Track | null, b: Track | null): boolean {
  return !!a && !!b && a.recordingId === b.recordingId && a.start === b.start && a.end === b.end;
}
