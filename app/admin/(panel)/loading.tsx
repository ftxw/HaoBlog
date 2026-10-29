export default function AdminPanelLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">加载中…</span>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-24 animate-pulse rounded bg-admin-neutral-strong" />
          <div className="h-3 w-40 animate-pulse rounded bg-admin-neutral" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-md bg-admin-neutral-strong" />
      </div>

      <div className="admin-sheet-flush">
        <div className="admin-sheet-head">
          <div className="h-3.5 w-20 animate-pulse rounded bg-admin-neutral-strong" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-admin-border-soft px-5 py-3.5 last:border-b-0"
          >
            <div className="h-10 w-14 shrink-0 animate-pulse rounded-md bg-admin-neutral" />
            <div className="h-3.5 flex-1 animate-pulse rounded bg-admin-neutral" />
            <div className="h-3.5 w-16 shrink-0 animate-pulse rounded bg-admin-neutral" />
          </div>
        ))}
      </div>
    </div>
  );
}
