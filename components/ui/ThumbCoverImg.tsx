"use client";

import { thumbUrlOf, markImgBroken } from "@/app/lib/image-thumb";

export default function ThumbCoverImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // 通用缩略图包装：需 onError 失败即占位，原生 <img> 才能满足，属预期降级
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbUrlOf(src)}
      alt={alt}
      className={className}
      onError={(e) => markImgBroken(e.currentTarget, src)}
    />
  );
}
