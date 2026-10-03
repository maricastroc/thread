type IconProps = { className?: string; size?: number };

export function PlayIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d="M4.5 2.6v10.8c0 .5.5.8.9.5l8.1-5.4a.6.6 0 0 0 0-1L5.4 2.1c-.4-.3-.9 0-.9.5Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <rect x="3.5" y="2.5" width="3" height="11" rx="0.8" fill="currentColor" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function StopIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="10" height="10" rx="1.6" fill="currentColor" />
    </svg>
  );
}

export function CloseIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowIcon({ className, size = 16, direction = "right" }: IconProps & { direction?: "right" | "left" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={direction === "left" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M2.5 8h10.5M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ className, size = 18 }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <circle cx="7.75" cy="7.75" r="5.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="m11.75 11.75 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function RecordDot({ className, size = 12 }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="5" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ImportIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d="M8 2.5v7.5M4.75 6.75 8 10l3.25-3.25M3 12.5h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
