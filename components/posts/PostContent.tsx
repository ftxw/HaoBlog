"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { POST_BODY_STYLE } from "@/app/lib/post-body-style";
import { escapeRegExp } from "@/app/lib/utils";

interface PostContentProps {
  contentHtml: string;
  highlightKeyword?: string;
}

export default function PostContent({ contentHtml, highlightKeyword }: PostContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  useEffect(() => {
    const keyword = (highlightKeyword || "").trim();
    const root = contentRef.current;
    if (!keyword || !root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.textContent || "";
        return text.toLowerCase().includes(keyword.toLowerCase())
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const textNodes: Text[] = [];
    let _tn: Node | null = walker.nextNode();
    while (_tn) {
      textNodes.push(_tn as Text);
      _tn = walker.nextNode();
    }

    textNodes.forEach((node) => {
      const text = node.textContent || "";
      const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, "gi"));
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (part.toLowerCase() === keyword.toLowerCase()) {
          const mark = document.createElement("mark");
          mark.className = "search-highlight";
          mark.textContent = part;
          frag.appendChild(mark);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode?.replaceChild(frag, node);
    });

    const first = root.querySelector("mark.search-highlight");
    if (first) {
      const y = first.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [highlightKeyword]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const imgs = Array.from(
      root.querySelectorAll<HTMLImageElement>("img[data-original]")
    );
    const onErr = (e: Event) => {
      const img = e.currentTarget as HTMLImageElement;
      const original = img.dataset.original;
      if (!original) return;
      if (img.getAttribute("src") === original) return;
      img.setAttribute("src", original);
    };
    imgs.forEach((img) => img.addEventListener("error", onErr));
    return () => imgs.forEach((img) => img.removeEventListener("error", onErr));
  }, [contentHtml]);

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      setLightboxSrc(img.dataset.original || img.currentSrc || img.src);
    }
  }

  return (
    <>
      <div className="relative">
        <style>{POST_BODY_STYLE}</style>

        <div
          id="article-content"
          ref={contentRef}
          className="post-body"
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </div>

      {typeof document !== "undefined" &&
        lightboxSrc &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightboxSrc(null)}
          >
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxSrc(null);
            }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="关闭预览"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- 正文图片可为图床/外链动态 URL，原生 img 直连 */}
          <img
            src={lightboxSrc}
            alt="预览大图"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
          </div>,
          document.body
        )}
    </>
  );
}
