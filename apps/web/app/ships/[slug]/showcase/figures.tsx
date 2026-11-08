/** The headline figures under a showcase hero: large mono numbers, units small, source stated. */

export interface Figure {
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
}

export function Figures({
  figures,
  source,
}: {
  readonly figures: readonly Figure[];
  readonly source: string;
}) {
  if (figures.length === 0) return null;
  return (
    <section aria-label="Headline figures" className="border-y border-hairline">
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-12">
        <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-5">
          {figures.map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <dt className="text-caption text-secondary">{f.label}</dt>
              <dd className="m-0 text-primary">
                <span className="font-mono text-display">{f.value}</span>
                {f.unit === undefined ? null : (
                  <span className="text-ui text-secondary"> {f.unit}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="m-0 text-caption text-secondary">{source}</p>
      </div>
    </section>
  );
}
