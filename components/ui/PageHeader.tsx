import type { ReactNode } from "react";
import Reveal from "@/components/ui/Reveal";

export default function PageHeader({
  title,
  subtitle,
  right,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal
      y={-20}
      className={`mb-12 flex flex-col items-center justify-between gap-6 md:flex-row md:items-end ${className}`}
    >
      <div>
        <h1 className="mb-2 text-4xl font-black tracking-widest text-ink md:text-5xl">{title}</h1>
        {subtitle && <p className="font-medium tracking-wider text-ink-2">{subtitle}</p>}
      </div>

      {right}
    </Reveal>
  );
}
