"use client";

import { useId, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { PAPER, THEME_EVENT, THEME_KEY, parseTheme, type Theme } from "@/lib/theme";

const choices: Theme[] = ["system", "light", "dark"];

function read(): Theme {
  const cookie = document.cookie.split("; ").find((part) => part.startsWith(`${THEME_KEY}=`));
  if (cookie) return parseTheme(cookie.slice(THEME_KEY.length + 1));
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = theme !== "system" ? theme : meta.media ? (meta.media.includes("dark") ? "dark" : "light") : system;
    meta.content = PAPER[scheme];
  });
}

function subscribe(onChange: () => void) {
  const saved = read();
  persist(saved);
  apply(saved);
  const sync = () => {
    apply(read());
    onChange();
  };
  window.addEventListener("storage", sync);
  window.addEventListener(THEME_EVENT, sync);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener(THEME_EVENT, sync);
  };
}

function persist(theme: Theme) {
  document.cookie = theme === "system" ? `${THEME_KEY}=; path=/; max-age=0; samesite=lax` : `${THEME_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

function choose(theme: Theme) {
  persist(theme);
  apply(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeChoice({ initial }: { initial: Theme }) {
  const id = useId();
  const current = useSyncExternalStore(subscribe, read, () => initial);
  return (
    <div role="radiogroup" aria-labelledby={id} className="t-small flex items-center gap-1 text-ink-2">
      <span id={id} className="mr-1">
        {t.theme.label}
      </span>
      {choices.map((choice) => (
        <label key={choice} className="relative inline-flex min-h-11 cursor-pointer items-center">
          <input type="radio" name={id} value={choice} checked={current === choice} onChange={() => choose(choice)} className="peer visually-hidden" />
          <span className="rounded-sm px-1.5 py-0.5 underline-offset-[0.3em] transition-colors peer-checked:text-ink peer-checked:underline peer-checked:decoration-ink peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] peer-focus-visible:outline hover:text-ink">
            {t.theme[choice]}
          </span>
        </label>
      ))}
    </div>
  );
}
