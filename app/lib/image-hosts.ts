/** 「哪些远程图片域名可以交给 next/image 优化」的唯一真源。 */
const STATIC_IMAGE_HOSTS = [
  "avatars.githubusercontent.com", // GitHub 头像
  "api.dicebear.com", // dicebear 匿名头像
] as const;

export const OPTIMIZABLE_IMAGE_HOSTS: readonly string[] = [...STATIC_IMAGE_HOSTS];

export const IMAGE_REMOTE_PATTERNS = OPTIMIZABLE_IMAGE_HOSTS.map((hostname) => ({
  protocol: "https" as const,
  hostname,
}));
