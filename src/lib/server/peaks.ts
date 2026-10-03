import "server-only";
import { PEAKS_PER_SECOND } from "./audio";

export function slicePeaks(peaks: Uint8Array | null, start: number, end: number, buckets: number): number[] {
  if (!peaks?.length) return [];
  const from = Math.max(0, Math.floor(start * PEAKS_PER_SECOND));
  const to = Math.min(peaks.length, Math.max(from + 1, Math.ceil(end * PEAKS_PER_SECOND)));
  const span = to - from;
  const count = Math.max(1, Math.min(buckets, span));
  const out: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const a = from + Math.floor((i * span) / count);
    const b = Math.max(a + 1, from + Math.floor(((i + 1) * span) / count));
    let max = 0;
    for (let k = a; k < b; k++) if (peaks[k] > max) max = peaks[k];
    out[i] = Math.round((max / 255) * 1000) / 1000;
  }
  return out;
}
