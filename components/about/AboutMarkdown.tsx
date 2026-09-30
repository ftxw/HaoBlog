import { cachedRenderPost } from "@/app/lib/post-render";
import { POST_BODY_STYLE } from "@/app/lib/post-body-style";

import "highlight.js/styles/vs2015.css";
import "katex/dist/katex.min.css";

export default async function AboutMarkdown({
  markdown,
  cdnDomain,
}: {
  markdown: string;
  cdnDomain: string;
}) {
  const { contentHtml } = await cachedRenderPost(markdown, cdnDomain);

  return (
    <div className="relative">
      <style>{POST_BODY_STYLE}</style>
      <div className="post-body" dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </div>
  );
}
