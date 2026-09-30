import { Pulse, SkeletonPage } from "@/components/ui/PageSkeleton";

export default function Loading() {
  const col = (keyPrefix: string, withImageAt: number | null) =>
    [0, 1, 2].map((i) => (
      <div key={`${keyPrefix}-${i}`} className="glass rounded-card p-5 md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <Pulse className="h-9 w-9 rounded-full" />
          <div className="flex flex-col gap-2">
            <Pulse className="h-3 w-28 rounded" />
            <Pulse className="h-3 w-20 rounded" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Pulse className="h-4 w-full rounded" />
          <Pulse className="h-4 w-[92%] rounded" />
          {i === withImageAt ? (
            <Pulse className="h-44 w-full rounded-card-sm" />
          ) : (
            <Pulse className="h-4 w-[64%] rounded" />
          )}
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-hairline-soft pt-4">
          <Pulse className="h-4 w-12 rounded" />
          <Pulse className="h-4 w-12 rounded" />
        </div>
      </div>
    ));

  return (
    <SkeletonPage filter filterTall>
      <div className="flex w-full flex-col items-start gap-5 pb-32 md:flex-row md:gap-8">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-5 md:gap-8">
          {col("l", 1)}
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-5 md:gap-8">
          {col("r", 0)}
        </div>
      </div>
    </SkeletonPage>
  );
}
