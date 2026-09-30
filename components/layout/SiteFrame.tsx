"use client";

import { usePathname } from "next/navigation";
import BackgroundRenderer from "@/components/layout/BackgroundRenderer";
import Navbar from "@/components/layout/Navbar";
import ClientWidgets from "@/components/layout/ClientWidgets";
import StatsTracker from "@/components/layout/StatsTracker";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";

export default function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  const icpName = useConfigValue("icp_name");
  const icpLink = useConfigValue("icp_link");
  const gonganName = useConfigValue("gongan_name");
  const gonganLink = useConfigValue("gongan_link");
  const hasIcp = Boolean(icpName || gonganName);

  if (isAdmin) {
    return <div className="flex-1 flex flex-col">{children}</div>;
  }

  return (
    <>
      <BackgroundRenderer />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <Navbar />

        <main className="flex-1 pb-16 sm:pb-20">{children}</main>

        {hasIcp && (
          <footer>
            <div className="mono-num mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-3 px-5 pb-6 text-xs text-ink-4 sm:px-8">
              {icpName ? (
                <a
                  href={icpLink || "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="no-underline transition hover:text-ink-3"
                >
                  {icpName}
                </a>
              ) : null}
              {gonganName ? (
                <a
                  href={gonganLink || "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="no-underline transition hover:text-ink-3"
                >
                  {gonganName}
                </a>
              ) : null}
            </div>
          </footer>
        )}
      </div>

      <ClientWidgets />
      <StatsTracker />
    </>
  );
}
