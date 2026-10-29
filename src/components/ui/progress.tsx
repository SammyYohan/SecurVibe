export type ProgressProps = {
  /** Valeur actuelle entre 0 et 100. */
  value: number;
  ariaLabel?: string;
  className?: string;
};

export function Progress({ value, ariaLabel, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={
        className ?? "h-2 w-full overflow-hidden rounded-full bg-slate-800"
      }
    >
      <div
        className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
