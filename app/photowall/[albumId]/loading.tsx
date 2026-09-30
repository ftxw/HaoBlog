import { Pulse } from "@/components/ui/PageSkeleton";

const COLUMNS: number[][] = [
  [260, 200],
  [300, 180],
  [220, 260],
  [280, 210],
];

export default function Loading() {
  return (
    <div className="relative" aria-busy="true" aria-live="polite">
      <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">
        <span className="sr-only">加载中…</span>

        <div className="mb-12 flex flex-col justify-between gap-4 border-b border-hairline-soft pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-4">
              <Pulse className="h-7 w-28 rounded-lg" />
              <span className="h-1.5 w-1.5 rounded-full bg-hairline" />
              <Pulse className="h-3 w-24 rounded" />
            </div>
            <Pulse className="mb-2 h-9 w-56 rounded-lg md:h-12 md:w-72" />
            <Pulse className="h-5 w-64 rounded md:w-80" />
          </div>
          <Pulse className="h-11 w-32 shrink-0 rounded-2xl" />
        </div>

        <div className="columns-1 gap-6 space-y-6 sm:columns-2 md:columns-3 lg:columns-4">
          {COLUMNS.map((heights, colIdx) => (
            <div key={colIdx} className="contents">
              {heights.map((h, i) => (
                <div
                  key={i}
                  className="break-inside-avoid overflow-hidden rounded-2xl border border-hairline"
                >
                  <div
                    className="w-full animate-pulse bg-surface-strong"
                    style={{ height: h }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
