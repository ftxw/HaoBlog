"use client";

import { useEffect, useState } from "react";

/**
 * 后台 Markdown 预览：用**与正文完全相同**的管线（app/lib/markdown-core.ts）渲染，
 * 保证「预览即所得」。
 *
 * 为什么不能用 useMemo 同步渲染：
 *   unified 的 .process() 是异步的（插件链里的 transformer 允许 await），
 *   没有同步 API。所以这里放到 effect 里做，
 *   并处理两个必要的边界：
 *     ① 竞态 —— 输入速度可能快于渲染，旧结果必须丢弃（用 cancelled 标记）；
 *     ② 异步期间的状态 —— 首次渲染前 html 为空，属于正常（预览区短暂空白）。
 *
 * @param content Markdown 原文
 * @param enabled 是否处于预览态（编辑态下不渲染，省掉无谓的解析开销）
 * @returns 渲染出的 HTML 字符串（未就绪时为空串）
 */
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
