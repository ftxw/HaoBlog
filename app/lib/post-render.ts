import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import { normalizeMarkdown, createMarkdownProcessor } from "./markdown-core";
import { thumbUrlOf, resolveImageUrl } from "./image-thumb";
import { assignHeadingIds, extractToc } from "./toc-ids";
import type { TocItem } from "./toc-ids";
import { escapeRegExp } from "./utils";

/** 目录项与「markdown 源 → 目录项 → 写回 HTML id」的纯计算实现都在 ./toc-ids。 */
export type { TocItem };

export interface RenderPostOptions {
  /** 图床直链域名，未配时传空串。必须由调用方显式传入（不要读模块级单例，layout/page 并发渲染会读到空串）。 */
  cdnDomain: string;
}

/** 正文图片有站内代理路径与图床直链两种形态，都要改写成缩略图。 */
function buildImgSrcPattern(domain: string): RegExp {
  const alternatives = ["/api/img-proxy/imgs/[^\"']+"];
  if (domain) alternatives.push(`${escapeRegExp(domain)}/[^\"']+`);
  return new RegExp(
    `(<img\\b[^>]*?src=["'])((?:${alternatives.join("|")}))(["'])`,
    "gi"
  );
}

export async function renderPostContent(
  content: string,
  options: RenderPostOptions
): Promise<{ contentHtml: string; toc: TocItem[] }> {
  const mdContent = normalizeMarkdown(content);
  const domain = options.cdnDomain;

  const processed = await createMarkdownProcessor().process(mdContent);

  let contentHtml = processed.toString();
  contentHtml = contentHtml.replace(
    buildImgSrcPattern(domain),
    (_m, pre: string, src: string, post: string) => {
      const thumb = thumbUrlOf(src, domain);
      const original = resolveImageUrl(src, domain);
      if (thumb === src && original === src) return _m;
      return `${pre}${thumb}${post} data-original="${original}"`;
    }
  );

  // toc 的 id 就是 assignHeadingIds 写进 HTML 的那份（与 extractToc 共用同一套 slug 规则）。
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

// v8：normalizeMarkdown 不再做容错补正，渲染结果变了，必须换 key 失效旧缓存。
const RENDER_CACHE_VERSION = "v8-no-md-fallback";

const RENDER_CACHE_TTL_SEC = 3600;

/** 渲染正文（带 Data Cache）。`cdnDomain` 必传，理由见 RenderPostOptions。 */
export const cachedRenderPost = async (content: string, cdnDomain: string) => {
  // 没配图床域名时无需缓存：此时图片改写对代理路径是恒等变换，开销可以忽略。
  if (!cdnDomain) {
    return renderPostContent(content, { cdnDomain });
  }
  const keyParts = [
    "post-render",
    RENDER_CACHE_VERSION,
    createHash("sha1").update(content).digest("hex"),
    cdnDomain,
  ];
  return unstable_cache(
    (c: string, d: string) => renderPostContent(c, { cdnDomain: d }),
    keyParts,
    { revalidate: RENDER_CACHE_TTL_SEC }
  )(content, cdnDomain);
};
