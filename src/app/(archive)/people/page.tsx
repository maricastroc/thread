import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EntityIndex } from "@/components/entities/EntityIndex";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { listEntities, listRecordings } from "@/lib/server/repo";

export const metadata: Metadata = { title: t.entities.people };

export default async function PeoplePage() {
  const vault = await loadVault();
  if (!vault) redirect("/");
  const language = listRecordings().find((r) => r.language)?.language ?? null;
  return (
    <EntityIndex
      title={t.entities.people}
      intro={t.entities.peopleIntro(vault.narrator)}
      empty={t.entities.empty}
      entities={listEntities("person")}
      base="/people"
      language={language}
    />
  );
}
