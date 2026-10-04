import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Recorder } from "@/components/record/Recorder";
import { t } from "@/lib/i18n";
import { config } from "@/lib/server/config";
import { loadVault } from "@/lib/server/data";
import { listRecordings } from "@/lib/server/evidence";
import { openQuestions } from "@/lib/server/interpretation";

export const metadata: Metadata = { title: t.nav.record };

function ReadOnlyRecord({ subject, question }: { subject: string; question: string | null }) {
  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <header className="flex h-14 items-center justify-between">
          <p className="font-serif text-[1.25rem] tracking-[-0.01em] text-ink-2">{t.record.forArchive(subject)}</p>
          <Link href="/" className="-mr-3 inline-flex h-12 items-center rounded-full px-4 text-[1.0625rem] text-ink-2 hover:text-ink">
            {t.record.close}
          </Link>
        </header>
        <div className="my-auto py-16">
          {question && (
            <div className="mb-12">
              <p className="t-kicker">{t.readOnly.question}</p>
              <p className="mt-3 max-w-[30ch] font-serif text-[clamp(1.5rem,1.2rem+1vw,2rem)] leading-snug">{question}</p>
            </div>
          )}
          <h1 className="t-title max-w-[22ch]">{t.readOnly.recordTitle}</h1>
          <p className="t-reading mt-6 max-w-[38rem] text-ink-2">{t.readOnly.recordBody(subject)}</p>
          <a
            href={config.repository}
            className="mt-10 inline-flex min-h-11 items-center gap-2 text-[1.0625rem] underline decoration-rule-2 underline-offset-[0.3em] hover:decoration-ink"
          >
            {t.readOnly.run}
          </a>
        </div>
      </div>
    </main>
  );
}

export default async function RecordPage(props: PageProps<"/record">) {
  const vault = await loadVault();
  if (!vault) redirect("/");
  const { q } = await props.searchParams;
  const question = typeof q === "string" && q.trim() ? q.trim().slice(0, 300) : null;
  if (config.readOnly) return <ReadOnlyRecord subject={vault.subject} question={question} />;
  const offset = listRecordings().length;
  const generic = t.record.prompts.map((_, i, all) => all[(i + offset) % all.length]);
  const prompts = [
    ...openQuestions(6).map((text) => ({ text, fromArchive: true })),
    ...generic.map((text) => ({ text, fromArchive: false })),
  ].filter((p) => p.text !== question);

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <Recorder subject={vault.subject} prompts={prompts} initialQuestion={question} />
    </main>
  );
}
