const STATIC_IMAGE_HOSTS = [
  "avatars.githubusercontent.com",
  "api.dicebear.com",
  // 知乎图床：站内文章封面会引用它。加进白名单后交由 next/image 处理，
  // 才能真正生效 sizes/srcset 并转成 WebP/AVIF（此前会降级成原生 <img>，
  // 1440w JPEG 被直接塞进 715×218 的槽位，单张浪费 60+ KB）。
  "picx.zhimg.com",
  "pic1.zhimg.com",
  "pic2.zhimg.com",
  "pic3.zhimg.com",
  "pic4.zhimg.com",
] as const;

export const OPTIMIZABLE_IMAGE_HOSTS: readonly string[] = [...STATIC_IMAGE_HOSTS];

export const IMAGE_REMOTE_PATTERNS = OPTIMIZABLE_IMAGE_HOSTS.map((hostname) => ({
  protocol: "https" as const,
  hostname,
}));
