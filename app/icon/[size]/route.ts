export const revalidate = 86400;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDbSiteConfig, pickConfigValue } from "@/app/lib/site-config-db";
import { normalizeCdnDomain, resolveImageUrl } from "@/app/lib/image-thumb";

/**
 * PWA / iOS 安装图标。
 *
 * Android 装到桌面要 192 与 512 的 PNG，iOS 添加到主屏要 apple-touch-icon
 * （180×180，且不能是 webp）。而站点图标来自用户上传的头像，尺寸与格式都不固定，
 * 所以这里按请求实时转成固定尺寸 PNG，manifest 与 metadata 都指向本路由。
 *
 * 头像可能存放在私有图床（只能经 /api/img-proxy 取），因此统一先解析成
 * 同源可访问的 URL 再抓取，避免直连外部地址失败。
 */

const SIZES = new Set([180, 192, 512]);


export async function GET(request: Request) {
  const url = new URL(request.url);
  const size = Number(url.pathname.split("/").pop());
  if (!SIZES.has(size)) {
    return new NextResponse("不支持的尺寸", { status: 404 });
  }

  try {
    const cfg = await getDbSiteConfig();
    const avatar = pickConfigValue(cfg, "avatarUrl");
    if (!avatar) return new NextResponse("未配置图标", { status: 404 });

    const cdn = normalizeCdnDomain(cfg.imageCdnDomain);
    const resolved = resolveImageUrl(avatar, cdn);
    const target = new URL(resolved, url.origin).toString();

    const res = await fetch(target, {
      // 私有图床的代理地址带有 long-lived 缓存，这里跟随即可
      cache: "force-cache",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return new NextResponse("图标读取失败", { status: 502 });

    const input = Buffer.from(await res.arrayBuffer());
    const { default: sharp } = await import("sharp");

    const png = await sharp(input)
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "CDN-Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[icon] 生成图标失败:", err);
    return new NextResponse("图标生成失败", { status: 500 });
  }
}

