/**
 * 「哪些远程图片域名可以交给 next/image 优化」的**唯一真源**。
 *
 * 它有两个消费方，两者必须一致：
 *   · `next.config.ts` 的 `images.remotePatterns`（构建期，决定 next/image 允许抓取谁）
 *   · `components/ui/SafeImage.tsx` 的 `ALLOWED_REMOTE_HOSTS`（运行期，决定用 next/image 还是 <img>）
 *
 * ⚠️ 不要在消费方各写一份白名单：新增一个头像源时只改一处就会错配 ——
 *   · 只改 config → SafeImage 仍把该域名判为"不可优化"，降级原生 <img>（白白丢掉优化）；
 *   · 只改 SafeImage → next/image 在运行期直接报错（域名不在 remotePatterns）。
 * 两种都很难查，因为都不报明确的错。
 *
 * 因此两边都 import 本模块，改一处即全局生效。
 *
 * ⚠️ 图床的 `imageCdnDomain` 是**后台运行时配置**，而 `remotePatterns` 是**构建期**常量，
 * 两者生命周期对不上 —— 所以运行期配的 CDN 域名不会被收录，图片会降级为原生 `<img>`
 * （能正常显示，只是少了 next/image 的尺寸/格式优化）。这是刻意的取舍：
 * 为此引入一个构建期环境变量属于「为了边缘场景多一条配置路径」，不做。
 */
const STATIC_IMAGE_HOSTS = [
  "avatars.githubusercontent.com", // GitHub 头像
  "api.dicebear.com", // dicebear 匿名头像
] as const;

export const OPTIMIZABLE_IMAGE_HOSTS: readonly string[] = [...STATIC_IMAGE_HOSTS];

export const IMAGE_REMOTE_PATTERNS = OPTIMIZABLE_IMAGE_HOSTS.map((hostname) => ({
  protocol: "https" as const,
  hostname,
}));
