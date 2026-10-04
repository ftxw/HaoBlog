import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import { normalizeMarkdown, createMarkdownProcessor } from "./markdown-core";
import { thumbUrlOf, resolveImageUrl } from "./image-thumb";
import { assignHeadingIds, extractToc } from "./toc-ids";
import type { TocItem } from "./toc-ids";
import { escapeRegExp } from "./utils";

export type { TocItem };

export interface RenderPostOptions {
  cdnDomain: string;
}

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

const RENDER_CACHE_VERSION = "v8-no-md-fallback";

const RENDER_CACHE_TTL_SEC = 3600;

export const cachedRenderPost = async (content: string, cdnDomain: string) => {
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
