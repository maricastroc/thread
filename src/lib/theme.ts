export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "thread-theme";
export const THEME_EVENT = "thread-theme";
export const PAPER = { light: "#f7f3ea", dark: "#141311" } as const;

export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
