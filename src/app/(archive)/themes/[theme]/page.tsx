import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { StoryRow } from "@/components/StoryRow";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { listStories } from "@/lib/server/repo";
import { peaksForStories } from "@/lib/server/timeline";
import { sortYear } from "@/lib/server/when";
import { THEMES, type Theme } from "@/lib/types";

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

export async function generateMetadata(props: PageProps<"/themes/[theme]">): Promise<Metadata> {
  const { theme } = await props.params;
  return { title: isTheme(theme) ? t.themes[theme] : t.entities.themes };
}

export default async function ThemePage(props: PageProps<"/themes/[theme]">) {
  const { theme } = await props.params;
  if (!isTheme(theme)) notFound();
  const vault = await loadVault();
  if (!vault) redirect("/");
  const stories = listStories(vault.birthYear)
    .filter((s) => s.themes.includes(theme))
    .sort((a, b) => (sortYear(a.when) ?? 9999) - (sortYear(b.when) ?? 9999));
  if (!stories.length) notFound();
  const peaks = peaksForStories(stories, 44);

  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="pt-2 sm:pt-4">
        <Link href="/" className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
          <ArrowIcon direction="left" size={14} className="transition-transform group-hover:-translate-x-0.5" />
          {t.story.allStories}
        </Link>
      </nav>
      <header className="pt-6 pb-10 sm:pt-10">
        <p className="t-kicker mb-5">{t.story.themes}</p>
        <h1 className="t-display">{t.themes[theme]}</h1>
        <p className="t-meta mt-5">{t.entities.themeStories(stories.length)}</p>
      </header>
      <ol className="relative max-w-5xl border-t border-rule before:absolute before:top-9 before:bottom-14 before:left-[4px] before:w-px before:bg-rule">
        {stories.map((story) => (
          <StoryRow key={story.id} story={story} peaks={peaks.get(story.id) ?? []} />
        ))}
      </ol>
    </section>
  );
}
