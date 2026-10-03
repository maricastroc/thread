import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EntityMoments } from "@/components/entities/EntityMoments";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { getEntity } from "@/lib/server/repo";

export async function generateMetadata(props: PageProps<"/people/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const vault = await loadVault();
  return { title: getEntity(id, vault?.birthYear ?? null)?.entity.name ?? t.entities.people };
}

export default async function PersonPage(props: PageProps<"/people/[id]">) {
  const { id } = await props.params;
  const vault = await loadVault();
  if (!vault) redirect("/");
  const data = getEntity(id, vault.birthYear);
  if (!data || data.entity.kind !== "person") notFound();
  return (
    <EntityMoments
      back={{ href: "/people", label: t.entities.people }}
      entity={data.entity}
      stories={data.stories}
      facts={data.facts}
      segments={data.segments}
      language={data.stories[0]?.language ?? null}
    />
  );
}
