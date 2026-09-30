import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import { normalizeMarkdown, createMarkdownProcessor } from "./markdown-core";
import { thumbUrlOf, resolveImageUrl, getCdnDomain } from "./image-thumb";
import { assignHeadingIds, extractToc } from "./toc-ids";
import type { TocItem } from "./toc-ids";

/** 目录项与「markdown 源 → 目录项 → 写回 HTML id」的纯计算实现都在 ./toc-ids。 */
export type { TocItem };

export interface RenderPostOptions {
  /** 图床直链域名。服务端渲染期应由调用方从站点配置读取后显式传入。 */
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

  // toc 项里的 id 就是 assignHeadingIds 要写进 HTML 的那一份（extractToc
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

// v6：assignHeadingIds 修掉了"标题自带 id 时其后锚点整体错位"的缺陷（v5 及更早
const RENDER_CACHE_VERSION = "v6-toc-anchor";

const RENDER_CACHE_TTL_SEC = 3600;

/** 渲染正文（带 Data Cache）。 */
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
