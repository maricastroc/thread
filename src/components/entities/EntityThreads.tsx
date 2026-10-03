import Link from "next/link";
import { t } from "@/lib/i18n";
import type { Life, LifeEntity, LifeStory } from "@/lib/life";

type Thread = {
  entity: LifeEntity;
  dated: LifeStory[];
  undated: number;
  first: number | null;
  last: number | null;
};

function threadsOf(life: Life, kind: "person" | "place"): Thread[] {
  const byId = new Map(life.stories.map((s) => [s.id, s]));
  return life.entities
    .filter((e) => e.kind === kind)
    .map((entity) => {
      const stories = entity.storyIds.map((id) => byId.get(id)).filter((s): s is LifeStory => !!s);
      const dated = stories.filter((s) => s.year !== null).sort((a, b) => a.year! - b.year!);
      return {
        entity,
        dated,
        undated: stories.length - dated.length,
        first: dated[0]?.year ?? null,
        last: dated.at(-1)?.year ?? null,
      };
    })
    .sort((a, b) => (a.first ?? 9999) - (b.first ?? 9999) || b.entity.storyIds.length - a.entity.storyIds.length || a.entity.name.localeCompare(b.entity.name));
}

export function EntityThreads({ life, kind }: { life: Life; kind: "person" | "place" }) {
  const years = life.stories.filter((s) => s.year !== null).map((s) => s.year!);
  const start = life.birthYear ?? (years.length ? Math.min(...years) - 2 : life.now - 10);
  const end = life.now;
  const at = (year: number) => `${((year + 0.5 - start) / (end - start + 1)) * 100}%`;
  const decades: number[] = [];
  for (let d = Math.ceil(start / 10) * 10; d <= end; d += 10) decades.push(d);
  const threads = threadsOf(life, kind);
  const base = kind === "person" ? "/people" : "/places";
  const language = life.stories[0]?.language ?? undefined;

  return (
    <div>
      <div aria-hidden="true" className="hidden md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-x-10">
        <span />
        <div className="relative h-6">
          {decades.map((d) => (
            <span key={d} className="t-time absolute top-0 -translate-x-1/2 text-ink-3" style={{ left: at(d) }}>
              {d}
            </span>
          ))}
        </div>
      </div>
      <ol className="border-t border-rule">
        {threads.map(({ entity, dated, undated, first, last }) => {
          const relation = entity.relation && entity.relation.toLowerCase() !== entity.name.toLowerCase() ? entity.relation : null;
          const span = first === null ? null : first === last ? String(first) : `${first}–${last}`;
          return (
            <li key={entity.id} className="group relative grid gap-y-3 border-b border-rule py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-center md:gap-x-10">
              <div className="min-w-0">
                <Link
                  href={`${base}/${entity.id}`}
                  lang={language}
                  className="font-serif text-[1.375rem] leading-tight decoration-rule-2 underline-offset-[0.2em] after:absolute after:inset-0 after:content-[''] group-hover:underline"
                >
                  {entity.name}
                </Link>
                <p className="t-small mt-0.5 text-ink-2">
                  {relation && (
                    <>
                      <span lang={language}>{relation}</span>
                      <span aria-hidden="true"> · </span>
                    </>
                  )}
                  {t.entities.stories(entity.storyIds.length)}
                  {span && <span className="tabular-nums"> · {span}</span>}
                  {undated > 0 && <span> · {t.entities.unplaced(undated)}</span>}
                </p>
              </div>
              <div aria-hidden="true" className="relative h-5">
                <span className="absolute inset-x-0 top-1/2 h-px bg-rule" />
                {first !== null && last !== null && first !== last && (
                  <span className="absolute top-1/2 h-[1.5px] bg-ink" style={{ left: at(first), right: `calc(100% - ${at(last)})` }} />
                )}
                {dated.map((story) => {
                  const certain = story.certainty === "exact" || story.certainty === "range";
                  return (
                    <span
                      key={story.id}
                      className={`absolute top-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink ${certain ? "bg-ink" : "bg-paper"}`}
                      style={{ left: at(story.year!) }}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
