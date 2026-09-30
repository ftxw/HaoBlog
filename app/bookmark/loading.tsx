import { Pulse, SkeletonPage } from "@/components/ui/PageSkeleton";

export default function Loading() {
  return (
    <SkeletonPage search>
      <div className="glass mb-8 w-full rounded-card p-3">
        <div className="flex w-full flex-wrap justify-center gap-2 md:justify-start">
          {Array.from({ length: 5 }).map((_, i) => (
            <Pulse key={i} className="h-8 w-20 rounded-xl" />
          ))}
        </div>
      </div>

      {Array.from({ length: 2 }).map((_, section) => (
        <section key={section} className={section === 0 ? "mb-8" : undefined}>
          <div className="mb-4 flex items-center gap-2.5 md:mb-6">
            <Pulse className="h-6 w-28 rounded md:h-7 md:w-32" />
            <Pulse className="h-5 w-8 rounded-pill" />
          </div>

          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="glass flex h-full items-center gap-2.5 rounded-card-sm p-3 md:gap-3 md:rounded-card md:p-4"
              >
                <Pulse className="h-10 w-10 flex-shrink-0 rounded-full md:h-12 md:w-12" />
                <div className="min-w-0 flex-1">
                  <Pulse className="h-4 w-3/4 rounded" />
                  <Pulse className="mt-1.5 h-3 w-full rounded" />
                  <Pulse className="mt-1 h-3 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </SkeletonPage>
  );
}
