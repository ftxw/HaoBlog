import { Pulse } from "@/components/ui/PageSkeleton";

const BODY_WIDTHS = ["w-full", "w-[95%]", "w-full", "w-[88%]", "w-full", "w-[72%]"];
const BODY_WIDTHS_2 = ["w-full", "w-[90%]", "w-[97%]", "w-[60%]"];

export default function Loading() {
  return (
    <div className="relative pb-20">
      <div className="container-page relative z-10 flex flex-col gap-6 pb-6 pt-6 md:gap-8 md:pt-12">
        <span className="sr-only">加载中…</span>

        <div className="glass min-w-0 flex-1 overflow-hidden rounded-card">
          <Pulse className="aspect-video max-h-[300px] w-full rounded-none" />
          <div className="relative p-5 md:p-12">
            <Pulse className="mb-6 h-8 w-24 rounded-pill" />
            <div className="mb-6 border-b border-hairline-soft pb-5 md:mb-8 md:pb-6">
              <Pulse className="mb-4 h-8 w-11/12 rounded md:h-10" />
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <Pulse className="h-7 w-40 rounded-pill" />
                <Pulse className="h-7 w-20 rounded-pill" />
                <Pulse className="h-7 w-24 rounded-pill" />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {BODY_WIDTHS.map((w) => (
                <Pulse key={w} className={`h-4 rounded ${w}`} />
              ))}
              <Pulse className="mt-2 h-40 w-full rounded-card" />
              {BODY_WIDTHS_2.map((w) => (
                <Pulse key={`b-${w}`} className={`h-4 rounded ${w}`} />
              ))}
            </div>
            <div className="mt-12 md:mt-16">
              <Pulse className="mb-6 h-6 w-32 rounded" />
              <Pulse className="h-28 w-full rounded-card" />
            </div>
          </div>
        </div>

        <aside className="flex w-full flex-shrink-0 flex-col gap-6 lg:w-[320px]">
          <div className="glass rounded-card p-6 text-center">
            <Pulse className="mx-auto mb-4 h-20 w-20 rounded-full" />
            <Pulse className="mx-auto mb-2 h-5 w-28 rounded" />
            <Pulse className="mx-auto mb-4 h-3 w-40 rounded" />
            <div className="flex justify-center gap-2">
              {["a", "b", "c"].map((k) => (
                <Pulse key={k} className="h-10 w-10 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="glass rounded-card p-6">
            <Pulse className="mb-4 h-4 w-32 rounded" />
            <div className="flex flex-col gap-4">
              {["r1", "r2", "r3"].map((k) => (
                <div key={k} className="flex flex-col gap-2">
                  <Pulse className="h-4 w-4/5 rounded" />
                  <Pulse className="h-3 w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="glass rounded-card p-6">
            <Pulse className="mb-4 h-4 w-20 rounded" />
            <div className="flex flex-col gap-3">
              {["t1", "t2", "t3", "t4", "t5"].map((k) => (
                <Pulse key={k} className="h-3 w-full rounded" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
