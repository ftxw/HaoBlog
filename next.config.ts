import type { NextConfig } from "next";
// 图片白名单唯一真源，与 components/ui/SafeImage.tsx 共用（相对路径：配置加载器里别名不一定可用）。
import { IMAGE_REMOTE_PATTERNS } from "./app/lib/image-hosts";

// 全站安全响应头，静态声明以免走 middleware 调用。
const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // 浏览器已弃用该头，设 0 关闭以免误报
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // CSP 保持 Report-Only：图床域名与音乐 API 都是后台运行时配置，转强制会连带拦掉图片和歌词。
  // connect-src 必须留 https: —— 浏览器直传 S3 的 endpoint 来自运行时配置。
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "media-src 'self' https:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

// 生产环境强制 HTTPS。
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  });
}

const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_IMAGE = "public, max-age=86400, stale-while-revalidate=3600";

const nextConfig: NextConfig = {
  // 不发送 X-Powered-By，避免暴露框架指纹。
  poweredByHeader: false,

  // 函数运行区域在 vercel.json 的 regions（hnd1 东京，与 Supabase 同城）。
  // React Compiler：编译期自动记忆化，对高频 setState 的客户端组件收益明显。
  reactCompiler: true,

  // 开启后所有路由段配置都要整站重新过一遍，暂不启用。
  // cacheComponents: true,

  devIndicators: false,
  // Next 15+ 默认只信任 localhost，走 127.0.0.1 预览需显式声明（纯 host）。
  allowedDevOrigins: ["127.0.0.1"],

  experimental: {
    optimizePackageImports: ["lucide-react"],

    // 客户端 Router Cache 的 stale 时间（秒）。static 下限是 30，写 0 会被判 invalid-next-config。
    // dynamic 取 30 让后台侧边栏导航能复用预取的 RSC（前台是静态/ISR，不受影响）。
    staleTimes: {
      dynamic: 30,
      static: 30,
    },
  },

  // 响应头规则：多条命中同一请求时按顺序合并，同一 key 后者覆盖前者。
  //
  // 与 route 的关系是另一层，且已核实：Next 在把请求交给处理器**之前**就把这里的头写到
  // res 上（router-server.js 里 resHeaders 的应用点在 invokeRender 之前），处理器随后
  // setHeader 会覆盖同 key。Vercel 文档亦明确「Function 返回的 Cache-Control 优先于
  // next.config.js 中的同路由声明」。
  // => 下面的规则是**默认值**，route 自己声明的优先。故 API 通吃 no-store 是安全的兜底。
  async headers() {
    return [
      // 1. 安全响应头（生产环境额外追加 HSTS），覆盖全部路径
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // 2. API 一律不缓存，保证后台写入后前台立即可见
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      // 3. 带内容 hash 的静态资源：长缓存
      {
        source: "/:path(.*\\.(?:js|css|woff|woff2|ttf|svg|ico))",
        headers: [{ key: "Cache-Control", value: CACHE_IMMUTABLE }],
      },
      // 4. public 下的图片资源：1 天 + stale-while-revalidate
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMAGE }],
      },
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMAGE }],
      },
      // 5. /api/img-proxy 与 /api/music/* 的缓存策略由各自 route 声明 —— 它们会覆盖上面第 2 条，
      //    所以这里不需要、也不该再按路径补一条：headers() 只能按路径匹配、无法按状态码区分，
      //    补了反而会把 404/503 也一起长缓存。
    ];
  },
  images: {
    // next/image 优化图（/_next/image）在 CDN 的最短缓存时间，默认仅 60s。
    minimumCacheTTL: 86400,
    // 白名单来自 app/lib/image-hosts.ts 这一唯一真源，勿在此手写域名。
    remotePatterns: IMAGE_REMOTE_PATTERNS,
  },
};

export default nextConfig;
