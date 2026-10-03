"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveVault } from "@/lib/server/archive";
import { getStoryRow, renameStory } from "@/lib/server/interpretation";
import { t } from "@/lib/i18n";

export type SetupState = { errors: { name?: string; year?: string }; values: { name: string; year: string; language: string } };

export async function setupVault(_previous: SetupState, form: FormData): Promise<SetupState> {
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const yearText = String(form.get("year") ?? "").trim();
  const language = String(form.get("language") ?? "auto");
  const values = { name, year: yearText, language };
  const errors: SetupState["errors"] = {};
  if (!name) errors.name = t.setup.nameRequired;
  const year = yearText ? Number(yearText) : null;
  if (yearText && (!Number.isInteger(year) || year! < 1880 || year! > new Date().getFullYear())) errors.year = t.setup.yearInvalid;
  if (errors.name || errors.year) return { errors, values };
  saveVault({ subject: name, birthYear: year, language: /^(auto|[a-z]{2})$/.test(language) ? language : "auto" });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function renameStoryAction(storyId: string, title: string): Promise<{ ok: boolean }> {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!clean || !getStoryRow(storyId)) return { ok: false };
  renameStory(storyId, clean);
  refresh();
  return { ok: true };
}
