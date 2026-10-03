import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Recorder } from "@/components/record/Recorder";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { openQuestions } from "@/lib/server/repo";

export const metadata: Metadata = { title: t.nav.record };

export default async function RecordPage(props: PageProps<"/record">) {
  const vault = await loadVault();
  if (!vault) redirect("/");
  const { q } = await props.searchParams;
  const question = typeof q === "string" && q.trim() ? q.trim().slice(0, 300) : null;
  const day = Math.floor(Date.now() / 86_400_000);
  const generic = t.record.prompts.map((_, i, all) => all[(i + day) % all.length]);
  const prompts = [
    ...openQuestions(6).map((text) => ({ text, fromArchive: true })),
    ...generic.map((text) => ({ text, fromArchive: false })),
  ].filter((p) => p.text !== question);

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <Recorder narrator={vault.narrator} prompts={prompts} initialQuestion={question} />
    </main>
  );
}
