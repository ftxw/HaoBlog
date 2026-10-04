import type { CSSProperties, ReactNode } from "react";

export default function FadeIn({
  children,
  className = "",
  delay = 0,
  y = 20,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const style = {
    "--reveal-y": `${y}px`,
    "--reveal-delay": `${Math.round(delay * 1000)}ms`,
  } as CSSProperties;

  return (
    <div className={className} data-reveal="" style={style}>
      {children}
    </div>
  );
}
