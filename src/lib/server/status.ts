import "server-only";
import { slicePeaks } from "./peaks";
import { isWaiting, liveLines } from "./pipeline";
import { getVault } from "./archive";
import { getPeaks, getRecording, getSegments } from "./evidence";
import { liveStories } from "./interpretation";

export function recordingStatus(id: string, after = 0, wantPeaks = true) {
  const recording = getRecording(id);
  if (!recording) return null;
  const vault = getVault();
  const live = recording.stage === "transcribing" && !recording.failedStage;
  const lines = live
    ? liveLines(id).map((l, i) => ({ idx: i, start: l.start, end: l.end, text: l.text }))
    : getSegments(id).map(({ idx, start, end, text }) => ({ idx, start, end, text }));

  let progress = recording.progress;
  if (live && recording.duration && lines.length) {
    progress = Math.max(progress, Math.min(0.99, lines[lines.length - 1].end / recording.duration));
  }

  const { originalFile: _file, ...summary } = recording;
  void _file;

  return {
    ...summary,
    progress,
    waiting: isWaiting(id),
    transcript: { source: live ? ("live" as const) : ("final" as const), total: lines.length, lines: lines.slice(after) },
    stories: liveStories(id, vault?.birthYear ?? null),
    peaks: wantPeaks && recording.duration ? slicePeaks(getPeaks(id), 0, recording.duration, 240) : null,
  };
}
