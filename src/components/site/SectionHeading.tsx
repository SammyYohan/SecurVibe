export function SectionHeading({
  id,
  kicker,
  title,
}: {
  id: string;
  kicker: string;
  title: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-accent">
        {kicker}
      </p>
      <h2
        id={id}
        className="mt-3.5 text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl"
      >
        {title}
      </h2>
    </div>
  );
}
