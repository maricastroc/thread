"use client";

import { useId, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { PAPER, THEME_EVENT, THEME_KEY, type Theme } from "@/lib/theme";

const choices: Theme[] = ["system", "light", "dark"];

function read(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = theme === "system" ? (meta.media.includes("dark") ? "dark" : "light") : theme;
    meta.content = PAPER[scheme];
  });
}

function subscribe(onChange: () => void) {
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

function choose(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}
  apply(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeChoice() {
  const id = useId();
  const current = useSyncExternalStore(subscribe, read, () => "system" as Theme);
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
