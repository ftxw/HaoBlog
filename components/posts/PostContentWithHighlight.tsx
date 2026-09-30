"use client";

import { useSearchParams } from "next/navigation";
import PostContent from "./PostContent";

export default function PostContentWithHighlight({
  contentHtml,
}: {
  contentHtml: string;
}) {
  const searchParams = useSearchParams();
  const keyword = searchParams.get("highlight") ?? "";
  return <PostContent contentHtml={contentHtml} highlightKeyword={keyword} />;
}
