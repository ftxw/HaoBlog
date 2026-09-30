"use client";

import { useConfigJson } from "@/components/providers/SiteConfigProvider";
import SafeImage from "@/components/ui/SafeImage";

const NO_LOGOS: string[] = [];

export default function ClientSocials() {
  const socialLogos = useConfigJson<string[]>("socialLogos", NO_LOGOS).filter(
    (x) => typeof x === "string"
  );

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
