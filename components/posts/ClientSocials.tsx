"use client";

import { useMemo } from "react";
import { siteConfig } from '@/siteConfig';
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import SafeImage from "@/components/ui/SafeImage";

export default function ClientSocials() {
  const socialLogosRaw = useConfigValue("socialLogos", JSON.stringify(siteConfig.socialLogos || []));
  const socialLogos = useMemo(() => {
    try {
      const parsed = JSON.parse(socialLogosRaw || "[]");
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [socialLogosRaw]);

  if (socialLogos.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap justify-center mt-4">
      {socialLogos.slice(0, 5).map((logo, i) => (
        <div
          key={`${logo}-${i}`}
          className="w-10 h-10 relative rounded-lg bg-surface overflow-hidden border border-hairline shadow-sm transform-gpu"
        >
          <SafeImage src={logo} alt={`social-logo-${i + 1}`} fill className="object-cover" />
        </div>
      ))}
    </div>
  );
}
