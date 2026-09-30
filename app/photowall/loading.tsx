import { Pulse, SkeletonPage } from "@/components/ui/PageSkeleton";

const COLUMNS: number[][] = [
  [220, 260],
  [280, 200],
  [200, 240],
  [250, 210],
];

export default function Loading() {
  return (
    <SkeletonPage filter={false}>
      <div className="mt-10 flex items-start gap-8">
        {COLUMNS.map((heights, colIdx) => (
          <div key={colIdx} className="flex min-w-0 flex-1 flex-col gap-8">
            {heights.map((h, i) => (
              <div key={i} className="glass overflow-hidden rounded-card">
                <div
                  className="w-full animate-pulse bg-surface-strong"
                  style={{ height: h }}
                />
                <div className="flex flex-col gap-2 p-4">
                  <Pulse className="h-4 w-3/5 rounded" />
                  <Pulse className="h-3 w-2/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
