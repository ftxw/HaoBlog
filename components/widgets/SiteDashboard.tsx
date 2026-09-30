"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";

function LiveClock() {
  const [text, setText] = useState("");

  useEffect(() => {
    const tick = () =>
      setText(
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick(); // 挂载后立刻填上，避免先闪一下占位
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return <>{text || "00:00:00"}</>;
}

function Uptime({ startDate }: { startDate: number }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = Date.now() - startDate;
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff / 3_600_000) % 24);
      setText(`${days}天 ${hours}小时`);
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [startDate]);

  return <span className="font-black text-accent">{text || "—"}</span>;
}

export default function SiteDashboard() {
  const buildDate = useConfigValue("buildDate");
  const START_DATE = useMemo(() => new Date(buildDate).getTime(), [buildDate]);

  const icpName = useConfigValue("icp_name");
  const icpLink = useConfigValue("icp_link");
  const gonganName = useConfigValue("gongan_name");
  const gonganLink = useConfigValue("gongan_link");

  return (
    <div className="group glass flex h-auto flex-col items-stretch overflow-hidden rounded-card transition-colors duration-700 md:h-20 md:flex-row">
      <div className="bg-stage text-stage-ink px-8 py-4 md:py-0 flex items-center justify-center font-mono text-2xl md:text-3xl font-black tracking-widest shadow-inner relative overflow-hidden group-hover:text-accent transition-colors">
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
        <LiveClock />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-black/50"></div>
      </div>

      <div className="flex-1 px-6 py-4 md:py-0 flex flex-wrap items-center justify-between gap-4 text-xs md:text-sm font-bold text-ink-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-tone-success animate-pulse"
            aria-hidden="true"
          ></span>
          <span>
            系统已稳定运行：
            <Uptime startDate={START_DATE} />
          </span>
        </div>

        <div className="flex gap-2">
          {icpName && (
            <a
              href={icpLink || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-card-sm border border-hairline bg-surface-strong px-2 py-1 no-underline shadow-sm transition-colors hover:text-accent"
            >
              <Shield className="h-3.5 w-3.5 text-accent" />
              {icpName}
            </a>
          )}
          {gonganName && (
            <a
              href={gonganLink || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-card-sm border border-hairline bg-surface-strong px-2 py-1 no-underline shadow-sm transition-colors hover:text-tone-danger"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-tone-danger" />
              {gonganName}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
