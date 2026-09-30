import { Pulse, SkeletonPage } from "@/components/ui/PageSkeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass overflow-hidden rounded-card">
            <Pulse className="h-40 w-full rounded-none sm:h-48" />
            <div className="flex flex-col gap-3 p-5">
              <Pulse className="h-5 w-4/5 rounded" />
              <Pulse className="h-4 w-full rounded" />
              <Pulse className="h-4 w-2/3 rounded" />
              <div className="mt-2 flex items-center gap-3">
                <Pulse className="h-5 w-16 rounded-pill" />
                <Pulse className="h-4 w-20 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
