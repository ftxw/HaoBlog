"use client";

import { useEffect, useState } from "react";

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
