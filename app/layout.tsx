import type { Metadata } from "next";
import "./globals.css";
// highlight.js 与 KaTeX 的 CSS 按需加载（仅文章详情与关于页引入），不在此全站注入。
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { MusicProvider } from "@/components/providers/MusicProvider";
import { SiteConfigProvider } from "@/components/providers/SiteConfigProvider";
import SiteFrame from "@/components/layout/SiteFrame";
import RevealObserver from "@/components/layout/RevealObserver";
import { getDbSiteConfig, getPublicSiteConfig, pickConfigValue } from "@/app/lib/site-config-db";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";
import {
  absoluteUrlOf,
  configureCdnDomain,
  normalizeCdnDomain,
  proxyUrlOf,
} from "@/app/lib/image-thumb";

export async function generateMetadata(): Promise<Metadata> {
  const dbConfig = await getDbSiteConfig();
  const base = new URL(await resolveSiteBaseUrl());
  const title = pickConfigValue(dbConfig, "title");
  const description = pickConfigValue(dbConfig, "bio");
  const avatar = pickConfigValue(dbConfig, "avatarUrl");
  const cover = avatar || pickConfigValue(dbConfig, "defaultPostCover");
  // 社交平台抓取、浏览器取 favicon 都不一定带 Referer，图床防盗链会拦掉直链，故统一换成站内地址。
  const proxied = (url: string) =>
    absoluteUrlOf(proxyUrlOf(url, normalizeCdnDomain(dbConfig.imageCdnDomain)), base.toString());
  // 两个键都可能被后台清空 → 无图可分享时不输出 og:image（空串会被解析成页面自身地址）
  const ogImage = cover ? proxied(cover) : undefined;
  const icon = avatar ? proxied(avatar) : undefined;

  return {
    metadataBase: base,
    title,
    description,
    // 站点图标即后台设置的作者头像，不写死；后台清空头像则交给浏览器默认图标。
    icons: icon ? { icon, apple: icon } : undefined,
    alternates: {
      types: {
        "application/rss+xml": "/feed",
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 必须是剔除私钥的子集：这份配置会作为 initialConfig 注入客户端 Provider。
  const dbConfig = await getPublicSiteConfig();

  configureCdnDomain(dbConfig.imageCdnDomain);

  const defaultTheme = pickConfigValue(dbConfig, "themeMode");
  const initialDark = defaultTheme !== "light";

  const themeInitScript = `(function(){try{var stored=localStorage.getItem("theme");var fallback=${JSON.stringify(
    defaultTheme
  )};var mode=stored==="light"||stored==="dark"?stored:fallback==="light"?"light":fallback==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):"dark";var dark=mode==="dark";var el=document.documentElement;el.classList.toggle("dark",dark);el.dataset.theme=mode;el.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;

  return (
    <html
      lang="zh-CN"
      data-theme={initialDark ? "dark" : "light"}
      className={`h-full antialiased ${
        initialDark ? "dark" : ""
      }`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {/* 必须包在 <style> 里。 */}
        <noscript
          dangerouslySetInnerHTML={{
            __html:
              "<style>[data-reveal]{opacity:1 !important;transform:none !important;}</style>",
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <RevealObserver />
        <SiteConfigProvider initialConfig={dbConfig}>
          <ThemeProvider>
            <MusicProvider>
              <ToastProvider>
                <SiteFrame>{children}</SiteFrame>
              </ToastProvider>
            </MusicProvider>
          </ThemeProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
