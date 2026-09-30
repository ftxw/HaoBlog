export default function Loading() {
  return (
    <div className="container-page relative z-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">加载中…</span>
      <div className="flex flex-col gap-6 pt-6 pb-6 md:pt-12">
        <div className="h-11 w-full max-w-md animate-pulse rounded-pill bg-surface-strong" />
        <div className="glass rounded-card h-[220px] animate-pulse" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="glass rounded-card-sm h-[200px] animate-pulse sm:col-span-2" />
          <div className="glass rounded-card-sm h-[200px] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
