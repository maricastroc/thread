import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EntityMoments } from "@/components/entities/EntityMoments";
import { Lifeline } from "@/components/life/Lifeline";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { loadLife } from "@/lib/server/life";
import { getEntity } from "@/lib/server/repo";

export async function generateMetadata(props: PageProps<"/places/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const vault = await loadVault();
  return { title: getEntity(id, vault?.birthYear ?? null)?.entity.name ?? t.entities.places };
}

export default async function PlacePage(props: PageProps<"/places/[id]">) {
  const { id } = await props.params;
  const vault = await loadVault();
  if (!vault) redirect("/");
  const data = getEntity(id, vault.birthYear);
  if (!data || data.entity.kind !== "place") notFound();
  return (
    <EntityMoments
      back={{ href: "/places", label: t.entities.places }}
      entity={data.entity}
      stories={data.stories}
      facts={data.facts}
      segments={data.segments}
      language={data.stories[0]?.language ?? null}
      lifeline={<Lifeline life={loadLife(vault)} initialTrail={id} trailKinds={["place"]} showTrailBar={false} syncUrl={false} />}
    />
  );
}
