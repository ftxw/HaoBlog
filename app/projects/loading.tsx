import { Pulse, SkeletonPage } from "@/components/ui/PageSkeleton";

export default function Loading() {
  return (
    <SkeletonPage search={false}>
      <div className="relative min-h-[500px] w-full overflow-hidden">
        <div className="absolute left-1/2 h-full -translate-x-1/2 rounded-full border-2 border-accent/20" />
        <div className="relative z-10 flex flex-col pb-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`relative flex w-full items-center justify-between ${
                i % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              <div className="glass flex w-full flex-col overflow-hidden rounded-card md:w-[calc(50%-4rem)]">
                <Pulse className="h-40 w-full rounded-none sm:h-48" />
                <div className="flex flex-1 flex-col p-6">
                  <Pulse className="mb-3 h-4 w-28 rounded" />
                  <Pulse className="mb-3 h-6 w-3/5 rounded" />
                  <Pulse className="h-4 w-full rounded" />
                  <Pulse className="mt-2 h-4 w-4/5 rounded" />
                </div>
              </div>
              <div className="hidden md:block md:w-[calc(50%-4rem)]" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
