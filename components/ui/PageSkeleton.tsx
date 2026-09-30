
export function Pulse({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-card bg-surface-strong ${className}`} />
  );
}

export function SkeletonPageHeader({ search = true }: { search?: boolean }) {
  return (
    <div className="mb-12 flex flex-col items-center justify-between gap-6 md:flex-row md:items-end">
      <div className="flex flex-col items-center gap-3 md:items-start">
        <Pulse className="h-9 w-40 rounded-lg md:h-12 md:w-48" />
        <Pulse className="h-4 w-56 rounded md:w-64" />
      </div>
      {search && <Pulse className="h-11 w-full max-w-md rounded-pill" />}
    </div>
  );
}

function SkeletonFilterBar({ tall = false }: { tall?: boolean }) {
  return <Pulse className={`mb-8 w-full ${tall ? "h-[68px]" : "h-14"}`} />;
}

export function SkeletonPage({
  children,
  filter = true,
  filterTall = false,
  search = true,
}: {
  children: React.ReactNode;
  filter?: boolean;
  filterTall?: boolean;
  search?: boolean;
}) {
  return (
    <div
      className="container-page relative z-10 pb-6 pt-6 md:pt-12"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">加载中…</span>
      <SkeletonPageHeader search={search} />
      {filter && <SkeletonFilterBar tall={filterTall} />}
      {children}
    </div>
  );
}
