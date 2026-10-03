import Link from "next/link";
import { t } from "@/lib/i18n";
import type { EntitySummary } from "@/lib/types";

export function EntityIndex({
  title,
  intro,
  empty,
  entities,
  base,
  language,
}: {
  title: string;
  intro: string;
  empty: string;
  entities: EntitySummary[];
  base: "/people" | "/places";
  language: string | null;
}) {
  const sorted = [...entities].sort((a, b) => a.name.localeCompare(b.name, language ?? undefined));
  const groups = new Map<string, EntitySummary[]>();
  for (const entity of sorted) {
    const letter = entity.name.normalize("NFD").replace(/\p{M}/gu, "").charAt(0).toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), entity]);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-14">
      <h1 className="t-display">{title}</h1>
      <p className="t-meta mt-5 max-w-[34rem]">{intro}</p>
      {entities.length === 0 ? (
        <p className="mt-16 text-[1.0625rem] text-ink-2">{empty}</p>
      ) : (
        <div className="mt-14 grid gap-x-12 border-t border-rule md:grid-cols-2">
          {[...groups.entries()].map(([letter, list]) => (
            <section key={letter} aria-labelledby={`letter-${letter}`} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-rule py-6">
              <h2 id={`letter-${letter}`} className="font-serif text-[1.5rem] leading-none text-ink-2">
                {letter}
              </h2>
              <ul className="space-y-4">
                {list.map((entity) => (
                  <li key={entity.id}>
                    <Link href={`${base}/${entity.id}`} className="group block">
                      <span className="font-serif text-[1.375rem] leading-tight decoration-rule-2 underline-offset-[0.18em] group-hover:underline" lang={language ?? undefined}>
                        {entity.name}
                      </span>
                      {entity.relation && entity.relation.toLowerCase() !== entity.name.toLowerCase() && (
                        <span className="text-[0.9375rem] text-ink-2" lang={language ?? undefined}>
                          {" "}
                          · {entity.relation}
                        </span>
                      )}
                      <span className="t-small mt-0.5 block text-ink-2">
                        {t.entities.stories(entity.storyCount)} · {t.entities.moments(entity.momentCount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
