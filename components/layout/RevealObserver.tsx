"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
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
