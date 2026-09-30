

export default function AdminPanelLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">加载中…</span>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="h-7 w-28 animate-pulse rounded bg-admin-neutral-strong" />
          <div className="h-3 w-44 animate-pulse rounded bg-slate-200/70" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-lg bg-admin-neutral-strong" />
      </div>

      <div className="rounded-xl border border-admin-border bg-admin-surface p-5 shadow-sm">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-9 w-14 shrink-0 animate-pulse rounded bg-slate-200/80" />
              <div className="h-4 flex-1 animate-pulse rounded bg-slate-200/70" />
              <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-slate-200/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
