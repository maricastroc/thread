import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EntityThreads } from "@/components/entities/EntityThreads";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { loadLife } from "@/lib/server/representation";

export const metadata: Metadata = { title: t.entities.people };

export default async function PeoplePage(props: PageProps<"/people">) {
  const vault = await loadVault();
  if (!vault) redirect("/");
  const params = await props.searchParams;
  const life = loadLife(vault);
  const trail = typeof params.trail === "string" ? params.trail : null;
  if (trail && life.entities.some((e) => e.id === trail && e.kind === "person")) redirect(`/people/${trail}`);
  const has = life.entities.some((e) => e.kind === "person");
  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-12">
      <h1 className="t-display">{t.entities.people}</h1>
      <p className="t-meta mt-5 mb-10 max-w-[34rem]">{t.life.peopleIntro(vault.subject)}</p>
      {has ? <EntityThreads life={life} kind="person" /> : <p className="text-[1.0625rem] text-ink-2">{t.entities.empty}</p>}
    </section>
  );
}
