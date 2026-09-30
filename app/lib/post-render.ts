import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import { normalizeMarkdown, createMarkdownProcessor } from "./markdown-core";
import { thumbUrlOf, resolveImageUrl, getCdnDomain } from "./image-thumb";
import { assignHeadingIds, extractToc } from "./toc-ids";
import type { TocItem } from "./toc-ids";

/**
 * 目录项与「markdown 源 → 目录项 → 写回 HTML id」的纯计算实现都在 `./toc-ids`。
 * 这里只做 re-export，保持原有引用路径可用（该模块能被 `tsx` 直接引，
 * 因为它们不 import `next/cache`，而本文件会）。
 */
export type { TocItem };

export interface RenderPostOptions {
  /**
   * 图床直链域名。服务端渲染期应由调用方从站点配置读取后显式传入，
   * 避免依赖模块级全局（layout 与 page 并行渲染时会有竞态）。
   * 省略时回落 `getCdnDomain()`（客户端通路依赖它，别改坏）。
   */
  cdnDomain?: string;
}

export async function renderPostContent(
  content: string,
  options: RenderPostOptions = {}
): Promise<{ contentHtml: string; toc: TocItem[] }> {
  const mdContent = normalizeMarkdown(content);
  const domain = options.cdnDomain ?? getCdnDomain();

  const processed = await createMarkdownProcessor().process(mdContent);

  let contentHtml = processed.toString();
  contentHtml = contentHtml.replace(
    /(<img\b[^>]*?src=["'])(\/api\/img-proxy\/imgs\/[^"']+)(["'])/gi,
    (_m, pre: string, src: string, post: string) => {
      const thumb = thumbUrlOf(src, domain);
      const original = resolveImageUrl(src, domain);
      if (thumb === src && original === src) return _m;
      return `${pre}${thumb}${post} data-original="${original}"`;
    }
  );

  // toc 项里的 id 就是 `assignHeadingIds` 要写进 HTML 的那一份（`extractToc`
  // 内部统一走 `buildUniqueIds`）—— 不要在这里另算一份，两处不同源会让目录锚点错位。
  const toc = extractToc(mdContent);
  contentHtml = assignHeadingIds(
    contentHtml,
    toc.map((item) => item.id)
  );

  return {
    contentHtml,
    toc,
  };
}

// v6：`assignHeadingIds` 修掉了"标题自带 id 时其后锚点整体错位"的缺陷（v5 及更早
//     的缓存产物里那些锚点是错的），客户端 `ClientTOC` 却用新算法算 id → 新旧混用
//     会让目录跳错章节。凡正文渲染链的输出发生变化都必须换版本号，
//     否则会把 Data Cache 里的旧 HTML 继续发出去。
const RENDER_CACHE_VERSION = "v6-toc-anchor";

const RENDER_CACHE_TTL_SEC = 3600;

/**
 * 渲染正文（带 Data Cache）。
 *
 * ⚠️ 域名未知时**不进缓存**：App Router 下 layout 与 page 可并行渲染，page 可能先于
 * layout 的 `configureCdnDomain` 读到空域名 —— 那样会把图片渲染成 `/api/img-proxy`
 * 形态并缓存到 "proxy" key：图片从此走函数代理而不是 CDN 直连，白烧函数调用与带宽。
 * 域名拿不到时降级为动态渲染，至少不会把「代理 URL」长期缓存。
 */
export const cachedRenderPost = async (content: string, cdnDomain?: string) => {
  const domain = cdnDomain ?? getCdnDomain();
  if (!domain) {
    return renderPostContent(content, { cdnDomain: domain });
  }
  const keyParts = [
    "post-render",
    RENDER_CACHE_VERSION,
    createHash("sha1").update(content).digest("hex"),
    domain,
  ];
  return unstable_cache(
    (c: string, d: string) => renderPostContent(c, { cdnDomain: d }),
    keyParts,
    { revalidate: RENDER_CACHE_TTL_SEC }
  )(content, domain);
};
