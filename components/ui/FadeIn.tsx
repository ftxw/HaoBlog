// 纯展示组件：无 state/effect/事件/浏览器 API，样式全靠 data-reveal 交给
// layout 里的 RevealObserver（客户端）用 IntersectionObserver 驱动。
// 仅被服务端页面（app/about/page.tsx、app/posts/[postId]/page.tsx）引用，
// 因此去掉 "use client" 让它回归服务端组件、退出客户端 bundle。
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
