"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 全站滚动入场观察器 —— 对齐母版 BaseLayout.astro 里那份全站统一的 [data-reveal] 脚本。
 *
 * 行为与母版逐项一致：
 *   · 选择器 [data-reveal]；幂等跳过 dataset.revealed === "true" / dataset.revealBound === "true"；
 *   · prefers-reduced-motion 或环境无 IntersectionObserver 时，直接把全部元素置 revealed
 *     （globals.css 另有 @media (prefers-reduced-motion: reduce) 兜底，双保险）；
 *   · IntersectionObserver 阈值 0.1 + rootMargin "0px 0px -5% 0px"，进入视口后置
 *     data-revealed="true" 并 unobserve（一次性，不再触发）；位移/延迟由内联
 *     --reveal-y / --reveal-delay 提供（见 globals.css 的 [data-reveal] 规则）；
 *   · 绑定后下一帧对「已在首屏（rect.top < 视口高 * 0.9）」的元素直接启动过渡，
 *     避免等观察回调造成一瞬空白。
 *
 * 【与母版的两点差异】
 *   1. 母版是 SSR 整页 + astro:page-load 重扫；Next 侧存在「客户端拉数据后才挂载」的
 *      [data-reveal] 节点（收藏夹/项目列表等），母版对此用 render/client/content.ts 的
 *      markRevealed 处理。这里改用 MutationObserver 兜住新节点（只在 childList 变化时按
 *      rAF 合并重扫，成本可忽略）。
 *   2. 元素显形时额外派发一个 "reveal" CustomEvent，供需要「进入视口时机」的组件复用
 *      （如说说卡片借此预取评论 —— 母版是静态站无评论系统，故无对应物）。
 *
 * 【2026-09-18 修：两个会导致元素「永远停在 opacity: 0」的缺陷】
 *   A. 清理时残留 `data-reveal-bound` 标记（真正的 bug）。
 *      母版的 initReveal 每次调用都**新建**一个 IntersectionObserver 且从不 disconnect，
 *      所以「已绑定」标记永远有效。而 React 这边 effect 是按 [pathname] 重建的，
 *      清理时会 io.disconnect() —— 但 DOM 上的 revealBound 标记留在原处，
 *      下一个观察器实例的 bindAll() 会把这些元素当成「已处理」而**永久跳过**。
 *      表现：元素再也不会显形（最典型的就是首页最底部那张状态卡，下拉后偶尔一直不出现）。
 *      修法：清理时把「已绑定但未显形」的标记摘掉，交给下一个实例重新接管。
 *   B. 只依赖 IntersectionObserver 单点判断（加固）。
 *      IO 会因底部收缩的 rootMargin(-5%) + threshold(0.1)、移动端地址栏伸缩引起的
 *      视口高度跳变、以及长页面快速滚动等因素漏报；一旦漏报就再没有第二次机会。
 *      修法：加一条**几何兜底** sweep —— 在 scroll / resize / orientationchange 时
 *      按 rAF 合并地检查「还没显形」的元素，只要它的顶边已越过视口 90% 就显形。
 *      判定阈值与上面首屏判定用的是同一个（0.9 × innerHeight），因此正常情况下
 *      IO 仍然先手触发，动画手感与母版一致；sweep 只在 IO 漏掉时补刀。
 *
 * 挂载点：app/layout.tsx（相当于母版 BaseLayout 的脚本位置），全站（含后台）都生效。
 */
export default function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    /** 置为已显形并广播 "reveal"（幂等） */
    const mark = (el: HTMLElement) => {
      if (el.dataset.revealed === "true") return;
      el.dataset.revealed = "true";
      el.dispatchEvent(new CustomEvent("reveal"));
    };

    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            mark(entry.target as HTMLElement);
            io?.unobserve(entry.target);
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
      );
    }

    const bindAll = () => {
      const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
        (el) => el.dataset.revealed !== "true" && el.dataset.revealBound !== "true",
      );
      if (targets.length === 0) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !("IntersectionObserver" in window)) {
        targets.forEach(mark);
        return;
      }

      requestAnimationFrame(() => {
        targets.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.9) mark(el);
        });
      });

      targets.forEach((el) => {
        el.dataset.revealBound = "true";
        if (el.dataset.revealed !== "true") io?.observe(el);
      });
    };

    let sweepRaf = 0;
    const sweep = () => {
      sweepRaf = 0;
      const pending = document.querySelectorAll<HTMLElement>(
        '[data-reveal]:not([data-revealed="true"])',
      );
      if (pending.length === 0) return;
      const limit = window.innerHeight * 0.9;
      pending.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < limit && rect.bottom > 0) {
          mark(el);
          io?.unobserve(el);
        }
      });
    };
    const scheduleSweep = () => {
      if (sweepRaf === 0) sweepRaf = requestAnimationFrame(sweep);
    };

    bindAll();

    window.addEventListener("scroll", scheduleSweep, { passive: true });
    window.addEventListener("resize", scheduleSweep);
    window.addEventListener("orientationchange", scheduleSweep);

    let pending = false;
    const mo = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        bindAll();
        sweep();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io?.disconnect();
      mo.disconnect();
      if (sweepRaf !== 0) cancelAnimationFrame(sweepRaf);
      window.removeEventListener("scroll", scheduleSweep);
      window.removeEventListener("resize", scheduleSweep);
      window.removeEventListener("orientationchange", scheduleSweep);

      document
        .querySelectorAll<HTMLElement>(
          '[data-reveal][data-reveal-bound="true"]:not([data-revealed="true"])',
        )
        .forEach((el) => {
          delete el.dataset.revealBound;
        });
    };
  }, [pathname]);

  return null;
}
