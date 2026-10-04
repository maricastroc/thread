import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportButton } from "@/components/ImportButton";
import { OutcomeLabel } from "@/components/recordings/Outcome";
import { RecordLink } from "@/components/SiteHeader";
import { WaveSignature } from "@/components/WaveSignature";
import { formatDate, formatDuration, formatMonthYear, languageName, sameDay } from "@/lib/format";
import { t } from "@/lib/i18n";
import { config } from "@/lib/server/config";
import { loadVault } from "@/lib/server/data";
import { getPeaks, listRecordings, transcriptSizes } from "@/lib/server/evidence";
import { storyCountsByRecording } from "@/lib/server/interpretation";
import { slicePeaks } from "@/lib/server/peaks";
import { outcomeOf } from "@/lib/sources";

export const metadata: Metadata = { title: t.recordings.title };

export default async function RecordingsPage() {
  const vault = await loadVault();
  if (!vault) redirect("/");
  const recordings = listRecordings();
  const sizes = transcriptSizes();
  const counts = storyCountsByRecording();
  const seconds = recordings.reduce((sum, r) => sum + (r.duration ?? 0), 0);
  const stories = [...counts.values()].reduce((sum, n) => sum + n, 0);

  const groups: { month: string; items: typeof recordings }[] = [];
  for (const recording of recordings) {
    const month = formatMonthYear(recording.recordedAt);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(recording);
    else groups.push({ month, items: [recording] });
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-12">
      <h1 className="t-display">{t.recordings.title}</h1>
      <p className="t-meta mt-5 max-w-[40rem]">{t.recordings.intro(vault.subject)}</p>
      {recordings.length > 0 && <p className="mt-3 text-[0.9375rem]">{t.recordings.summary(recordings.length, formatDuration(seconds, "long"), stories)}</p>}
      <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
        <RecordLink label={t.nav.record} />
        {!config.readOnly && <ImportButton hint={false} />}
      </div>

      {recordings.length === 0 ? (
        <p className="mt-12 border-t border-rule pt-8 text-[1.0625rem] text-ink-2">{t.recordings.empty}</p>
      ) : (
        <div className="mt-12">
          {groups.map((group) => (
            <section key={group.month} aria-labelledby={`month-${group.month}`} className="grid border-t border-rule pt-6 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-x-8">
              <h2 id={`month-${group.month}`} className="font-serif text-[1.5rem] leading-tight tracking-[-0.01em] md:sticky md:top-6 md:self-start">
                {group.month}
              </h2>
              <ol className="mt-2 md:mt-0">
                {group.items.map((recording) => {
                  const outcome = outcomeOf({ stage: recording.stage, failedStage: recording.failedStage, segments: sizes.get(recording.id) ?? 0, stories: counts.get(recording.id) ?? 0 });
                  const duration = recording.duration ?? 0;
                  const peaks = duration ? slicePeaks(getPeaks(recording.id), 0, duration, 72) : [];
                  const language = (sizes.get(recording.id) ?? 0) > 0 ? languageName(recording.language) : null;
                  const meta = [
                    duration ? formatDuration(duration) : null,
                    recording.source === "imported" ? t.recordings.imported : t.recordings.recorded,
                    language,
                    sameDay(recording.recordedAt, recording.createdAt) ? null : t.recordings.added(formatDate(recording.createdAt)),
                  ].filter(Boolean);
                  return (
                    <li key={recording.id} className="border-b border-rule last:border-b-0">
                      <Link
                        href={`/recordings/${recording.id}`}
                        className="group grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 py-5 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_auto]"
                      >
                        <span className="col-start-1 row-start-1 min-w-0">
                          <span className="block font-serif text-[1.25rem] leading-snug decoration-rule-2 underline-offset-[0.2em] group-hover:underline">
                            {formatDate(recording.recordedAt)}
                          </span>
                          <span className="t-small mt-0.5 block text-ink-2">{meta.join(" · ")}</span>
                          {recording.originalName && recording.source === "imported" && (
                            <span className="t-small mt-0.5 block truncate text-ink-3">{recording.originalName}</span>
                          )}
                        </span>
                        <span className="col-span-2 col-start-1 row-start-2 block min-w-0 self-center text-ink-3 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                          <WaveSignature peaks={peaks} height={22} fluid />
                        </span>
                        <OutcomeLabel outcome={outcome} className="col-start-2 row-start-1 self-start justify-self-end pt-1 sm:col-start-3" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
