import type { Metadata } from "next";
import "./globals.css";
// 说明：highlight.js 与 KaTeX 的 CSS 已改为按需加载——
// 仅在真正渲染 Markdown 代码高亮/公式的路由里引入：
//   app/posts/[postId]/page.tsx（文章详情）
//   components/about/AboutMarkdown.tsx（关于页）
// 不再全站注入，避免普通页面/后台白下载这两套样式。
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { MusicProvider } from "@/components/providers/MusicProvider";
import { SiteConfigProvider } from "@/components/providers/SiteConfigProvider";
import SiteFrame from "@/components/layout/SiteFrame";
import RevealObserver from "@/components/layout/RevealObserver";
import { getDbSiteConfig, getPublicSiteConfig } from "@/app/lib/site-config-db";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";
import { configureCdnDomain } from "@/app/lib/image-thumb";
import { siteConfig } from "@/siteConfig";

export async function generateMetadata(): Promise<Metadata> {
  const dbConfig = await getDbSiteConfig();
  const base = new URL(await resolveSiteBaseUrl());
  const title = dbConfig.title || siteConfig.title;
  const description = dbConfig.bio || siteConfig.bio;
  const ogImage =
    dbConfig.avatarUrl || dbConfig.defaultPostCover || siteConfig.avatarUrl || siteConfig.defaultPostCover;

  return {
    metadataBase: base,
    title,
    description,
    alternates: {
      types: {
        "application/rss+xml": "/feed",
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ⚠️ 必须是**剔除私钥**的子集：这份配置会作为 initialConfig 注入
  // SiteConfigProvider（客户端组件），而 getDbSiteConfig() 返回的是
  // site_config 全表（含 accessKey / secretKey）。传全量 = 把图床私钥
  // 明文写进每张前台页面的 HTML 源码，匿名访客和爬虫都能直接读到。
  const dbConfig = await getPublicSiteConfig();

  configureCdnDomain(dbConfig.imageCdnDomain);

  const defaultTheme = dbConfig.themeMode || siteConfig.themeMode;
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
        {/*
          ⚠️ 必须包在 <style> 里。
          <noscript> 的内容只有在脚本被禁用时才会被当成**标记**解析；
          而这仅仅是 CSS 文本 —— 没有 <style> 包裹就永远不会作为样式生效，
          于是 globals.css 里 [data-reveal]{opacity:0} 的兜底失效，
          无 JS / JS 加载失败 / 被拦截的访客会看到**整页空白**（元素永远停在 opacity:0）。
        */}
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
