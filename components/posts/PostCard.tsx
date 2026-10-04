"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import { resolveCoverChain } from "@/app/lib/content-cover";
import { formatDateCN } from "@/app/lib/format";
import { thumbUrlOf } from "@/app/lib/image-thumb";
import type { PostListItem } from "@/app/lib/queries/posts";

export type PostOut = PostListItem;

interface PostCardProps {
  post: PostOut;
}

export default function PostCard({ post }: PostCardProps) {
  const defaultCover = useConfigValue("defaultPostCover");
  const imageSrc = resolveCoverChain(post.cover, "", defaultCover).url;
  const [thumbBroken, setThumbBroken] = useState(false);
  const [prevSrc, setPrevSrc] = useState(imageSrc);
  if (prevSrc !== imageSrc) {
    setPrevSrc(imageSrc);
    setThumbBroken(false);
  }
  const displaySrc = thumbBroken ? imageSrc : thumbUrlOf(imageSrc);

  const dateStr = post.published_at
    ? formatDateCN(new Date(post.published_at))
    : "";

  return (
    <div className="h-full">
      <Link href={`/posts/${post.id}`} className="block group h-full">
        <div className="glass flex h-full flex-col overflow-hidden rounded-card transition-all duration-700 hover:scale-[1.02]">
          {imageSrc && (
            <div className="w-full h-40 sm:h-48 overflow-hidden relative bg-surface-muted">
              <SafeImage
                src={displaySrc}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="scrim-bottom pointer-events-none absolute inset-0 transition-transform duration-700 group-hover:scale-110"></div>
              {post.is_pinned && (
                <span className="absolute right-3 top-3 rounded-pill bg-surface-strong px-2.5 py-1 text-[10px] font-semibold text-ink shadow-sm">
                  置顶
                </span>
              )}
            </div>
          )}

          <div className="flex flex-1 flex-col p-6">
            <div className="mb-3 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-accent">
              <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
              {dateStr}
            </div>

            <h3 className="mb-3 line-clamp-2 text-lg font-bold leading-tight text-ink transition-colors duration-300 group-hover:text-accent">
              {post.title}
            </h3>

            {post.tags.length > 0 && (
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {post.tags.slice(0, 6).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-accent-hairline bg-accent-soft px-2 py-1 text-xs font-black text-accent"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

          </div>
        </div>
      </Link>
    </div>
  );
}
