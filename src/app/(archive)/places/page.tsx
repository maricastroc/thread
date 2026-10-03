import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lifeline } from "@/components/life/Lifeline";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { loadLife } from "@/lib/server/representation";

export const metadata: Metadata = { title: t.entities.places };

export default async function PlacesPage(props: PageProps<"/places">) {
  const vault = await loadVault();
  if (!vault) redirect("/");
  const params = await props.searchParams;
  const life = loadLife(vault);
  const hasPlaces = life.entities.some((e) => e.kind === "place");
  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-12">
      <h1 className="t-display">{t.entities.places}</h1>
      <p className="t-meta mt-5 mb-8 max-w-[34rem]">{t.life.placesIntro(vault.subject)}</p>
      {hasPlaces ? (
        <Lifeline
          life={life}
          trailKinds={["place"]}
          trailBarFirst
          initialTrail={typeof params.trail === "string" ? params.trail : null}
          initialStory={typeof params.story === "string" ? params.story : null}
        />
      ) : (
        <p className="text-[1.0625rem] text-ink-2">{t.entities.emptyPlaces}</p>
      )}
    </section>
  );
}
