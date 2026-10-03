import "server-only";
import type { Vault } from "@/lib/types";
import { db, num, type Row } from "./db";

export function getVault(): Vault | null {
  const row = db().prepare("SELECT narrator, birth_year, language FROM vault WHERE id = 1").get() as Row | undefined;
  if (!row) return null;
  return { narrator: String(row.narrator), birthYear: num(row.birth_year), language: String(row.language) };
}

export function saveVault(vault: Vault): void {
  db()
    .prepare(
      `INSERT INTO vault (id, narrator, birth_year, language, created_at) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET narrator = excluded.narrator, birth_year = excluded.birth_year, language = excluded.language`,
    )
    .run(vault.narrator, vault.birthYear, vault.language, new Date().toISOString());
}

export function getMeta(key: string): string | null {
  const row = db().prepare("SELECT value FROM meta WHERE key = ?").get(key) as Row | undefined;
  return row ? String(row.value) : null;
}

export function setMeta(key: string, value: string): void {
  db().prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
