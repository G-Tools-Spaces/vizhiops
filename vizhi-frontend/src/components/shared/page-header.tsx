export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ink)]">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--ink-secondary)]">{description}</p>
      </div>
      {action}
    </div>
  );
}
