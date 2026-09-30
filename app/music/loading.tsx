import { Pulse, SkeletonPageHeader } from "@/components/ui/PageSkeleton";

export default function Loading() {
  return (
    <div className="container-page relative z-10 pb-10 pt-6 md:pt-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">加载中…</span>
      <SkeletonPageHeader />

      <div className="flex w-full flex-col gap-6 md:grid md:h-[calc(100vh-320px)] md:max-h-[720px] md:min-h-[600px] md:grid-cols-12 md:items-stretch md:gap-8">
        <div className="min-w-0 md:col-span-5">
          <section className="glass relative flex h-full min-h-[460px] flex-col overflow-hidden rounded-card p-6 sm:min-h-[500px] md:min-h-0 md:p-8">
            <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center py-4 md:py-0">
              <Pulse className="mb-6 h-40 w-40 shrink-0 rounded-full sm:h-48 sm:w-48 md:mb-10 lg:h-56 lg:w-56 xl:h-64 xl:w-64" />
              <Pulse className="mb-2 h-5 w-44 rounded" />
              <Pulse className="mb-6 h-3 w-28 rounded" />
              <div className="mb-6 w-full max-w-sm">
                <Pulse className="h-1.5 w-full rounded-pill" />
                <div className="mt-2 flex justify-between">
                  <Pulse className="h-3 w-10 rounded" />
                  <Pulse className="h-3 w-10 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Pulse className="h-6 w-6 rounded-full" />
                <Pulse className="h-12 w-12 rounded-full" />
                <Pulse className="h-6 w-6 rounded-full" />
              </div>
            </div>
          </section>
        </div>

        <div className="min-w-0 md:col-span-7">
          <section className="glass relative flex h-[450px] flex-col overflow-hidden rounded-card md:h-full">
            <div className="mx-auto mt-4 flex w-48 shrink-0 items-center gap-1 rounded-pill border border-hairline bg-surface-strong p-1 md:mt-6 md:w-64">
              <Pulse className="h-8 flex-1 rounded-pill" />
              <Pulse className="h-8 flex-1 rounded-pill" />
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
              {["l1", "l2", "l3", "l4", "l5", "l6", "l7"].map((k) => (
                <Pulse key={k} className="h-4 w-3/5 rounded" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
