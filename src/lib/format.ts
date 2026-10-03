const locale = "en";

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, "0")}` : `${mm}:${String(sec).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds: number, style: "short" | "long" = "short"): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (style === "long") {
    if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} ${h === 1 ? "hour" : "hours"}`;
    if (m > 0) return `${m} ${m === 1 ? "minute" : "minutes"}`;
    return `${sec} seconds`;
  }
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return sec > 0 ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

export function formatSpokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
  if (m) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  if (sec || parts.length === 0) parts.push(`${sec} ${sec === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(iso));
}

export function formatTimeOfDay(iso: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function numberWord(n: number): string {
  return n >= 0 && n < words.length ? words[n] : String(n);
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

export function languageTag(code: string | null | undefined): string | undefined {
  if (!code || code === "auto") return undefined;
  return code;
}
