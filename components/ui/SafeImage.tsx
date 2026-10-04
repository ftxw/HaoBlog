"use client";

import Image from "next/image";
import type { ImageProps } from "next/image";
import { useState } from "react";
import { PLACEHOLDER_IMG } from "@/app/lib/image-thumb";
import { OPTIMIZABLE_IMAGE_HOSTS } from "@/app/lib/image-hosts";

const ALLOWED_REMOTE_HOSTS = new Set(OPTIMIZABLE_IMAGE_HOSTS);

function isOptimizableUrl(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    return ALLOWED_REMOTE_HOSTS.has(new URL(src).hostname.toLowerCase());
  } catch {
    return false;
  }
}

type SafeImageProps = Omit<ImageProps, "src" | "onError" | "placeholder" | "onLoad"> & {
  src: string;
  onLoad?: () => void;
};

export default function SafeImage({
  src,
  alt,
  fill,
  className,
  sizes,
  priority,
  quality,
  onLoad,
  ...rest
}: SafeImageProps) {
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);
  const errored = erroredSrc === src;
  const effectiveSrc = errored ? PLACEHOLDER_IMG : src;

  if (isOptimizableUrl(effectiveSrc)) {
    return (
      <Image
        src={effectiveSrc}
        alt={alt}
        fill={fill}
        className={className}
        sizes={sizes ?? (fill ? "100vw" : undefined)}
        priority={priority}
        quality={quality}
        placeholder="empty"
        onError={() => setErroredSrc(src)}
        onLoad={onLoad}
        {...rest}
      />
    );
  }

  const resolvedClassName = [
    fill ? "absolute inset-0 h-full w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const {
    unoptimized: _unoptimized,
    loader: _loader,
    blurDataURL: _blurDataURL,
    overrideSrc: _overrideSrc,
    ...domAttrs
  } = rest;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 白名单外 URL 的预期降级分支（见组件顶部注释），原生 img 是唯一可行实现
    <img
      {...domAttrs}
      src={effectiveSrc}
      alt={alt}
      className={resolvedClassName || undefined}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      onLoad={onLoad as React.ReactEventHandler<HTMLImageElement>}
      onError={() => setErroredSrc(src)}
    />
  );
}
