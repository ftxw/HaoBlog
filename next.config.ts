import type { NextConfig } from "next";
// 图片白名单的唯一真源：客户端 components/ui/SafeImage.tsx 读的是同一份文件。
// 用相对路径（而非 @/ 别名）—— next.config 在 Next 的配置加载器里求值，
// 别名解析不一定可用，相对路径最稳。
import { IMAGE_REMOTE_PATTERNS } from "./app/lib/image-hosts";

/**
 * 安全响应头：作用于**所有**路径（含静态资源）。
 *
 * 这些头原先由根目录的 `proxy.ts`（Next.js middleware）逐请求设置。
 * 用 next.config 的 `headers()` 静态声明后，响应头由路由层直接下发，
 * 不产生额外的 middleware 函数调用，行为与平台无关。
 */
const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // 现代浏览器已弃用 X-XSS-Protection，设为 0 关闭，避免误报
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // CSP：保持 **Report-Only**，不转强制。
  //
  // 为什么不转强制（这是一个刻意的决定，不是遗漏）：
  //   本站有几个**运行时可变**的外部源，都写在后台「站点配置」里，构建期无法枚举 ——
  //     · 图床直链域名（imageCdnDomain，图片全部直连该域名）
  //     · 音乐 Meting API 地址（可自建，客户端会请求它返回的 lrcUrl 歌词）
  //     · 音频播放地址（网易云 CDN，媒体流）
  //   一旦转成强制，管理员在后台改一次图床域名，全站图片就会被 CSP 拦掉 —— 是
  //   「配置改了、页面坏了、还看不出为什么」那类事故。而 CSP 对**性能没有任何收益**，
  //   所以这里选择「收紧但仍只观察」：策略本身是准确的，违规会出现在报告里，
  //   不会阻断页面。
  //
  // 收紧点：`connect-src` 原先写的是裸 `https:`（等于放开任意 https 源），
  // 现在收敛到实际会用到的几个具体源。
  //
  // ⚠️ 但图床直传必须放行：后台 `putToS3()` 从**浏览器**直接 PUT 到预签名 S3 endpoint，
  // 其域名来自运行时配置 `imageCdnDomain`（构建期拿不到），既非 self 也不匹配 supabase.co。
  // 因此 `connect-src` 保留 `https:`（与 `img-src` / `media-src` 保持一致）——
  // 否则一旦把 CSP 从 Report-Only 转强制，图片直传会全挂。
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
// `next build` 时 NODE_ENV=production，`next dev` 时 development，
// 与原 proxy.ts 的运行时判断行为一致。
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  });
}

const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_IMAGE = "public, max-age=86400, stale-while-revalidate=3600";

const nextConfig: NextConfig = {
  // 压缩（gzip/br）：Next 默认即为 true，无需显式声明。
  // 不发送 X-Powered-By（默认会带 `Next.js`，等于免费送框架指纹给扫描器）。
  poweredByHeader: false,

  /*
   * ⚠️ 函数运行区域在 **vercel.json** 里（`"regions": ["hnd1"]`），不在这里 ——
   * vercel.json 是 JSON，写不了注释，所以「为什么」记在这儿：
   *
   * Vercel 给**新建项目**的默认函数区域是 `iad1`（美东华盛顿）。本项目实测过一次，
   * 后果是每个请求都白付两笔跨洋往返：
   *   · 边缘节点（sin1 新加坡）→ 函数（iad1 美东）→ 回程：约 0.63s 固定开销，
   *     连 `/api/ping` 这种什么都不做的接口都要 0.65s TTFB；
   *   · 函数（美东）↔ Supabase（东京）查一次库再加 0.6~1.7s。
   * 折算下来一个真实查库请求 1.2~2.3s。
   *
   * 改到 `hnd1`（东京）后，函数与数据库同城、也离访客更近。
   * 想自己复核是否生效：看响应头 `X-Vercel-Id` 的**中间段**，形如
   * `sin1::hnd1::xxx` —— 第一段是边缘节点，第二段才是真正执行函数的区域。
   *
   * 也可以在 Vercel 面板 Settings → Functions → Function Regions 里设，
   * 但写进仓库才能跟着代码走（换项目/重建时不会丢）。
   * 注意 Hobby 套餐只能选**一个**区域，写多个会让部署在构建前直接失败。
   */
  // React Compiler：编译期自动记忆化组件与 hook 依赖，消除无谓重渲染。
  // 对评论区、管理后台表单、播放器、灯箱等高频 setState 的客户端组件收益明显；
  // 与手写 useMemo/useCallback 并存，运行时语义不变。
  reactCompiler: true,

  /**
   * ⚠️ cacheComponents 迁移**尚未开始**（不是「做完了只是没开」）。
   *
   * 复核结论（2026-10，Next 16.2.4 实际行为，已实测）：
   *   · 此前 29 个页面/布局里写的 `export const instant = false;` 是**死代码** ——
   *     `AppSegmentConfig` 的 zod schema 里没有 `instant` 这个键
   *     （node_modules/next/dist/build/segment-config/app/app-segment-config.js），
   *     未知键被静默丢弃，所以它从来没有生效过。
   *   · 正确的键名是 `unstable_instant`，由
   *     `server/app-render/instant-validation/instant-config.js::isPageAllowedToBlock()`
   *     读取。但 `next build` 会直接报错：
   *     「Route segment config "unstable_instant" requires `nextConfig.cacheComponents` to be enabled.」
   *     也就是说，在 cacheComponents 关闭时**两种写法都不成立**。
   *
   * 因此那 29 处导出已**整体删除**（连同 codemod 的说明注释），不再保留无效配置。
   * 真正需要它们的是「启用 cacheComponents」这**一次整站迁移**：届时页面里的
   * `revalidate` / `dynamic` 路由段配置与 `<Suspense>` 边界都要一起过一遍验证，
   * 并用官方 cache-components codemod 按**当时的** API 重新生成这些 opt-out。
   * 在那之前，下面这行保持关闭。
   */
  // cacheComponents: true,

  devIndicators: false,
  // 开发环境通过 127.0.0.1 预览，Next.js 15+ 默认只信任 localhost，
  // 必须显式配置 host（纯 host，不带 http://），否则 HMR 会被拦截。
  allowedDevOrigins: ["127.0.0.1"],

  /**
   * 说明：这里**不再需要** `serverExternalPackages`。
   *
   * `@prisma/client` 与 `@aws-sdk/client-s3` 都已在 Next 自带的默认外部包白名单里
   * （node_modules/next/dist/lib/server-external-packages.jsonc，共 79 项，含
   * `@prisma/client`、`prisma`、`pg`、`@aws-sdk/client-s3`），显式重复声明是多余的。
   * 只有**不在**该名单里的包才需要写这一项。
   */

  experimental: {
    optimizePackageImports: ["lucide-react"],

    /**
     * 客户端路由缓存（Router Cache）stale 时间，单位秒。
     *
     * Next 16 的默认值是 static: 300（5 分钟）/ dynamic: 0 —— 也就是「预取过的
     * 静态路由，5 分钟内再次导航直接用浏览器里那份 RSC，不回源」。它带来一个
     * 很难排查的现象：后台发布完内容、用导航链接跳到前台，看到的仍是 5 分钟前
     * 预取的旧内容（刷新一次就正常，所以几乎不会被当成 bug 报出来）。
     *
     * ⚠️ 取值约束（踩过一次）：`static` 的下限是 **30**，写 0 会被 Next 判为
     * invalid-next-config（构建时告警）。所以这里取允许的最小值 30 —— 相比默认的
     * 300 已经缩短 10 倍，是「不违反框架约束」前提下的最优解。
     * `dynamic` 没有这个下限，可以取 0（它的默认值本来就是 0）。
     *
     * 代价是每次客户端导航都可能重新取一次 RSC；实测文章详情的 RSC 载荷仅
     * 5.1KB(gzip)，而服务的又是会命中的 ISR 产物，所以这个代价可以忽略。
     *
     * 注意：这不影响 <Link> 的预取本身（预取照旧，导航依然快），只是缩短了
     * 浏览器把那份预取结果当作「仍然新鲜」的窗口。
     * 另外，后台内容写路径走的是 Server Action —— 其中的 revalidatePath 会
     * 顺带清掉客户端 Router Cache，所以「发布后自己刷新立即看到」不依赖这个值。
     */
    staleTimes: {
      /**
       * 30s：让**后台**的客户端导航能复用 RSC。
       *
       * 这里从 0 改成 30，理由如下（原先取 0 的分析只考虑了前台，漏了后台）：
       *   · 上面「代价可以忽略」的论证成立的前提是「RSC 由 CDN 上的 ISR 产物命中」，
       *     那是**前台**的情况；
       *   · 构建产物里所有 `ƒ`（动态）路由只有 `/api/*` 与 `/admin/*` 两组 ——
       *     前台页面全是 `○` 静态或 `●` ISR。所以这个值调整**只作用于后台**；
       *   · 后台的 RSC 是动态渲染、必须打到函数（东京，实测单次约 0.45s），
       *     取 0 会让侧边栏 `<Link>` 的预取**完全白费**（预取到了，但判定立即过期，
       *     导航时照样重取）。这正是「点在后台切页面很慢」的主要构成。
       *   · 内容新鲜度不受影响：写路径走 Server Action，其中的 revalidatePath
       *     会顺带清掉客户端 Router Cache（见上方说明）。
       * 如果以后新增了「客户端导航的公开动态页」，再回来评估这个值。
       */
      dynamic: 30,
      static: 30,
    },
  },

  /**
   * 响应头规则。
   *
   * 注意：多条规则命中同一请求时会**按顺序合并**，相同 key 由后面的规则覆盖
   * （next/dist/server/lib/router-utils/resolve-routes.js 里是
   * `resHeaders[key] = value`）。因此下面的顺序是刻意的：
   * 安全头 → /api 禁缓存 → 静态资源长缓存 → 图片 → 图床代理，后者覆盖前者。
   */
  async headers() {
    return [
      // 1. 安全响应头（生产环境额外追加 HSTS）—— /:path* 覆盖包括 / 在内的全部路径
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // 2. API 一律不缓存，保证后台写入后前台立即可见。
      //    （headers() 不支持按 method 过滤，故覆盖全部方法；POST/PUT 本身
      //     也不会被缓存，行为上无差异。）
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      // 3.（已移除）此处原有一条给全站 HTML 的
      //    `public, s-maxage=300, stale-while-revalidate=600`。
      //    移除原因（实测，2026-09-21）：
      //    · Vercel 文档明确：Function / 配置返回的 Cache-Control 会接管该路由的
      //      CDN 缓存策略，从而**绕过部署时的自动缓存失效**。后果是发版后 CDN 仍在
      //      下发上一版的 HTML，而它引用的 css/js chunk 已被新部署替换 → 永久 404
      //      （Vercel 在域名下只暴露当前部署的静态文件）→ 命中旧缓存的访客拿到
      //      「无样式 + 客户端 JS 报错」的破页面。实测破损窗口 0–300s 随机。
      //    · 同时它让「发布后前端立即更新」变成最长 5 分钟的等待，
      //      与项目目标直接冲突，而博客的访问量根本不需要这层缓存。
      //    现在 HTML 交回 Next 自行管理（revalidate / revalidateTag），
      //    静态资源仍走下面的 immutable 规则（文件名带内容 hash，本就该长缓存）。
      // 4. 带内容 hash 的静态资源：长缓存
      {
        source: "/:path(.*\\.(?:js|css|woff|woff2|ttf|svg|ico))",
        headers: [{ key: "Cache-Control", value: CACHE_IMMUTABLE }],
      },
      // 5. public 下的图片资源：1 天 + stale-while-revalidate
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMAGE }],
      },
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMAGE }],
      },
      // 6.（已移除）此处原有一条给 `/api/img-proxy/:path*` 的
      //    `Cache-Control: public, max-age=31536000, immutable`。
      //    移除原因（2026-09-30，与下面 music/lyrics 那条同源）：
      //    · `headers()` **只能按路径匹配、无法按状态码区分**。图床代理的
      //      「图片不存在（404）」「图床未配置（503）」「取图失败（502）」
      //      与正常图片走的是同一条路径，于是这条规则会把**错误响应也标记成
      //      "可缓存一年且不得重新验证"（immutable）**。一次图床抖动留下的 404
      //      会被钉死在该浏览器上，图床恢复、甚至重新发版都清不掉 ——
      //      而 Vercel CDN 的可缓存状态码里明确包含 404/410，所以服务端那层同样中招。
      //    · 雪上加霜的是"谁覆盖谁"本身并不确定：Vercel 文档称「函数返回的
      //      Cache-Control 优先于 next.config.js」，而本项目对 `/api/music/lyrics`
      //      实测到的却是相反结果（config 覆盖了 route）。两条路都能影响最终头，
      //      于是**无法**靠在 route 里对着写一遍来兜底。
      //    · 现在的做法见 app/api/img-proxy/[...path]/route.ts：缓存策略完全由该
      //      route 按分支声明，并额外用 `Vercel-CDN-Cache-Control` 独立控制 Vercel
      //      CDN —— 这个头本文件从不设置，因此不存在被覆盖的问题。
      //      成功 → 长缓存；错误 → no-store。两种"谁赢"的情形下都不会缓存错误。
      //      代价：若最终是第 2 条（`/api` → no-store）胜出，浏览器侧将不缓存图片，
      //      每次请求都落到 Vercel CDN（通常 HIT）。用一点浏览器缓存换掉
      //      "错误被永久钉死"，这个交换是划算的。
      // ⚠️（已移除）此处曾为 `/api/music/lyrics` 加过一条 `public, max-age=3600`。
      // 移除原因（2026-09-30 实测）：
      //   · `headers()` 的规则**会覆盖 route 自己设置的响应头**。实测该路由在
      //     错误分支返回 `Cache-Control: no-store`，线上响应头却是 `max-age=3600`；
      //   · 而 `headers()` **只能按路径匹配、无法按状态码区分** —— 也就是说这条规则
      //     必然把「暂无歌词（204）」「歌词获取失败（500）」也一起缓存一小时。
      //     「暂无歌词」多由上游 meting 临时超时导致，缓存它会让这一小时内换歌、
      //     重选歌都拿不到歌词 —— 正是这条规则本意要避免的问题。
      //   · 收益只是省几次函数调用，代价却是缓存住错误结果，不划算。
      // 现在歌词的缓存策略**完全由 app/api/music/lyrics/route.ts 自己声明**
      // （成功 1h、错误/空 no-store），并从第 2 条拿到兜底的 no-store。
    ];
  },
  images: {
    // next/image 优化图（/_next/image）在 CDN 的最短缓存时间。
    // 默认仅 60s，导致文章配图/头像每次过期都回源重新处理；提到 1 天。
    minimumCacheTTL: 86400,
    // ⚠️ 白名单来自 app/lib/image-hosts.ts 这一**唯一真源**，
    // 不要在这里手写域名 —— 客户端 components/ui/SafeImage.tsx 读的是同一份，
    // 两处漂移会导致「要么白降级成 <img>、要么 next/image 运行期报错」。
    remotePatterns: IMAGE_REMOTE_PATTERNS,
  },
};

export default nextConfig;
