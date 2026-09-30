// 纯展示组件：无 state/effect/事件/浏览器 API，样式全靠 data-reveal 交给
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
