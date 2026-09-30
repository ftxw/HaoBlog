"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { cleanMarkdownHeading, buildUniqueIds } from "@/app/lib/toc-ids";

type TocItem = {
  level: number;
  text: string;
  id: string;
};

const getDisplayText = (rawText: string) => cleanMarkdownHeading(rawText);

function setPageSmoothScroll(enabled: boolean) {
  document.documentElement.style.scrollBehavior = enabled ? "" : "auto";
}

export default function ClientTOC({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const tocRef = useRef<HTMLElement>(null);
  const ids = useMemo(() => buildUniqueIds(toc), [toc]);

  useEffect(() => {
    const el = tocRef.current;
    const nav = document.getElementById("site-nav");
    if (!el || !nav) return;

    const lg = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      el.style.top =
        lg.matches && nav.getAttribute("data-hidden") !== "true" ? "6rem" : "";
    };
    apply();

    const mo = new MutationObserver(apply);
    mo.observe(nav, { attributes: true, attributeFilter: ["data-hidden"] });
    lg.addEventListener("change", apply);
    return () => {
      mo.disconnect();
      lg.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    let paired: { el: Element; id: string }[] = [];

    const collect = () => {
      const contentDiv = document.getElementById('article-content');
      if (!contentDiv) {
        paired = [];
        return;
      }
      const els = Array.from(contentDiv.querySelectorAll('h1, h2, h3'));
      const fallback = els.some((el) => !el.id) ? buildUniqueIds(toc) : [];
      paired = els
        .map((el, i) => ({ el, id: el.id || fallback[i] || '' }))
        .filter((p) => Boolean(p.id));
    };

    const OFFSET = 150; // 标题进入视口顶部 150px 内即视为当前章节

    const handleScroll = () => {
      if (paired.length === 0 || paired.some((p) => !p.el.isConnected)) collect();
      if (paired.length === 0) return;

      let current = "";
      for (const { el, id } of paired) {
        if (el.getBoundingClientRect().top <= OFFSET) current = id;
        else break;
      }
      setActiveId(current);
    };

    collect();
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    const timer = setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearTimeout(timer);
    };
  }, [toc]);

  const rafRef = useRef<number | null>(null);

  const restoreScrollBehavior = () => {
    setPageSmoothScroll(true);
  };

  useEffect(() => restoreScrollBehavior, []);

  const scrollToHeading = (e: React.MouseEvent, id: string) => {
    const targetElement = document.getElementById(id);
    if (!targetElement) {
      console.warn("[ClientTOC] 找不到目录锚点，回退为原生跳转:", id);
      return;
    }
    e.preventDefault();

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setPageSmoothScroll(false);

    const offset = 100;
    const targetY = targetElement.getBoundingClientRect().top + window.scrollY - offset;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 600;
    let startTime: number | null = null;

    const easeInOutCubic = (t: number, b: number, c: number, d: number) => {
      t /= d / 2;
      if (t < 1) return c / 2 * t * t * t + b;
      t -= 2;
      return c / 2 * (t * t * t + 2) + b;
    };

    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;

      const nextY = easeInOutCubic(timeElapsed, startY, distance, duration);
      window.scrollTo(0, nextY);

      if (timeElapsed < duration) {
        rafRef.current = requestAnimationFrame(animation);
      } else {
        window.scrollTo(0, targetY);
        rafRef.current = null;
        restoreScrollBehavior();
      }
    };

    rafRef.current = requestAnimationFrame(animation);
  };

  if (!toc || toc.length === 0) return null;

  return (
    <nav
      ref={tocRef}
      data-toc-sticky
      aria-label="目录"
      className="glass rounded-card p-6 lg:sticky lg:top-6"
    >
      <h2 className="mb-4 border-l-4 border-accent pl-2 text-sm font-black uppercase tracking-widest text-ink">
        Contents
      </h2>
      <ul className="relative flex flex-col gap-3 text-sm">
        <div className="absolute left-[2px] top-0 bottom-0 w-[2px] bg-ink-4/30 rounded-full" />

        {toc.map((item, index) => {
          const displayText = getDisplayText(item.text);
          const uid = ids[index];
          const isActive = activeId === uid;

          return (
            <li
              key={uid}
              className={`flex items-center gap-2${isActive ? " toc-active" : ""}`}
            >
              <span className="toc-dot" aria-hidden="true" />
              <a
                href={`#${uid}`}
                onClick={(e) => scrollToHeading(e, uid)}
                className="no-underline text-ink-3 transition-colors"
              >
                {displayText}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}