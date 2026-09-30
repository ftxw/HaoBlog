import { Pulse } from "@/components/ui/PageSkeleton";

export default function Loading() {
  return (
    <div
      className="relative z-10 container-page flex flex-col gap-6 pb-6 pt-6 md:gap-8 md:pt-12"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">加载中…</span>

      <article className="glass min-w-0 flex-1 overflow-hidden rounded-card">
        <Pulse className="h-40 w-full rounded-none sm:h-48 md:h-64" />

        <div className="relative px-5 pb-10 sm:px-8 md:px-10">
          <Pulse className="-mt-12 h-24 w-24 rounded-full border-4 border-canvas md:-mt-16 md:h-32 md:w-32" />

          <div className="mb-12 mt-4 flex flex-col items-center gap-3 md:mb-16 md:mt-6 md:flex-row md:justify-between">
            <div className="flex flex-col items-center gap-3 md:items-start">
              <Pulse className="h-9 w-36 rounded-lg md:h-12 md:w-44" />
              <Pulse className="h-4 w-52 rounded" />
            </div>
          </div>

          <div className="mb-6 w-full border-t border-hairline md:mb-8" />

          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Pulse
                key={i}
                className={`h-4 rounded ${i % 3 === 2 ? "w-3/5" : "w-full"}`}
              />
            ))}
          </div>
        </div>
      </article>

      <aside className="flex w-full flex-shrink-0 flex-col gap-6 lg:w-[320px]">
        <div className="glass flex flex-col items-center rounded-card p-6">
          <Pulse className="mb-4 h-20 w-20 rounded-full" />
          <Pulse className="mb-2 h-5 w-24 rounded" />
          <Pulse className="h-4 w-full rounded" />
          <Pulse className="mt-2 h-4 w-4/5 rounded" />
        </div>

        <div className="glass rounded-card p-6">
          <Pulse className="mb-4 h-4 w-24 rounded" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Pulse className="h-4 w-4/5 rounded" />
                <Pulse className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-card p-6">
          <Pulse className="mb-4 h-4 w-20 rounded" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Pulse className="h-4 w-16 rounded" />
                <Pulse className="h-3 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
