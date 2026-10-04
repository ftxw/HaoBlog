import type { Metadata } from "next";
import "./globals.css";
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
  const proxied = (url: string) =>
    absoluteUrlOf(proxyUrlOf(url, normalizeCdnDomain(dbConfig.imageCdnDomain)), base.toString());
  const ogImage = cover ? proxied(cover) : undefined;
  const icon = avatar ? proxied(avatar) : undefined;

  return {
    metadataBase: base,
    title,
    description,
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
