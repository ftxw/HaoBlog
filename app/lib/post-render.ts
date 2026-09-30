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

/** 正则元字符转义（供拼接图床域名用）。 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 正文图片可能有两种形态：站内代理路径（未配图床域名时上传的旧图），
 * 或图床域名直链（配了 imageCdnDomain 之后上传的图），两种都要改写成缩略图。
 */
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
  options: RenderPostOptions = {}
): Promise<{ contentHtml: string; toc: TocItem[] }> {
  const mdContent = normalizeMarkdown(content);
  const domain = options.cdnDomain ?? getCdnDomain();

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

// v7：图片重写同时覆盖「图床域名直链」，此前配了 imageCdnDomain 的图会漏掉缩略图。
const RENDER_CACHE_VERSION = "v7-img-direct-link";

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
