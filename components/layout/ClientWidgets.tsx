"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const FloatingPlayer = dynamic(() => import("@/components/music/FloatingPlayer"), { ssr: false });
const BusinessLinkPanel = dynamic(() => import("@/components/widgets/BusinessLinkPanel"), { ssr: false });

/**
 * 前台悬浮挂件容器（音乐播放器 + 业务链接面板）。
 *
 * ⚠️ **必须先门控到「挂载之后」再渲染，不能直接 return 两个 `ssr:false` 的 dynamic 组件。**
 *
 * `ssr: false` 只保证「服务端不渲染它」，**不保证「客户端首帧不渲染它」**：
 * 这两个组件的 chunk 一旦在 hydration 开始前就已就绪（被预加载、命中浏览器缓存、
 * 或网络够快），React 会在水合的第一帧就把它们渲出来 —— 而服务端那边是「什么都没有」
 * → 元素级不匹配 → **首页稳定抛 hydration 错误码 418（`args[]=HTML`）**。
 * 这不是理论：2026-09-20 实测 `body` 的直接子元素里，SSR 少了
 * `<div class="fixed bottom-6 left-6 z-30">`（业务链接悬浮按钮），实时 DOM 里有 ——
 * 而且**时快时慢**（chunk 到得慢就不报），所以很容易被误判成「探针假象」而放过。
 *
 * 加了 `mounted` 门控后，服务端与客户端首帧都是 `null`，水合完成（effect 触发）才渲染，
 * 这个竞态就不存在了。悬浮件晚一帧出现，观感无差别。
 */
export default function ClientWidgets() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: 挂载门控，让首帧与 SSR 一致（见上）
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      <FloatingPlayer />
      <BusinessLinkPanel />
    </>
  );
}
