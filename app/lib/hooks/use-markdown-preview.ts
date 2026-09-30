"use client";

import { useEffect, useState } from "react";

/** 后台 Markdown 预览：用与正文完全相同的管线（app/lib/markdown-core.ts）渲染。 */
export function useMarkdownPreview(content: string, enabled: boolean): string {
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    import("@/app/lib/markdown-core")
      .then(({ renderMarkdownToHtml }) => renderMarkdownToHtml(content || ""))
      .then((out) => {
        if (!cancelled) setHtml(out);
      })
      .catch(() => {
        if (!cancelled) setHtml("");
      });

    return () => {
      cancelled = true;
    };
  }, [content, enabled]);

  return enabled ? html : "";
}
