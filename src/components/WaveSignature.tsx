type Props = {
  peaks: number[];
  className?: string;
  height?: number;
  barWidth?: number;
  gap?: number;
};

export function WaveSignature({ peaks, className, height = 24, barWidth = 2, gap = 2 }: Props) {
  if (!peaks.length) return null;
  const width = peaks.length * (barWidth + gap) - gap;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      {peaks.map((p, i) => {
        const h = Math.max(1.5, p * height);
        return (
          <rect key={i} x={i * (barWidth + gap)} y={(height - h) / 2} width={barWidth} height={h} rx={barWidth / 2} fill="currentColor" />
        );
      })}
    </svg>
  );
}
