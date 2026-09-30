/**
 * 从请求头解析客户端真实 IP。
 *
 * ⚠️ 优先级与**部署平台**强相关，改动前先读这段：
 *
 * 绝对不要引入 `eo-connecting-ip`：它是 **EdgeOne** 平台注入的头，本项目已迁到 Vercel，
 * 该头不再由平台下发，而 **Vercel 不会剥离未知头** —— 客户端只要自己带一个
 * `eo-connecting-ip: 1.2.3.4`，返回值就被顶掉了。
 * 而所有按 IP 维度的限流（评论发表、点赞、浏览量上报、登录失败锁定）都读这个函数，
 * 等于限流可被一行 curl 绕过。
 *
 * ## 读的三个头都由 Vercel 边缘**覆写**，客户端自带值会被丢弃
 *
 * 依据是 Vercel 官方 Request Headers 文档：
 *   · `x-forwarded-for` —— "we currently overwrite the X-Forwarded-For header and do not
 *     forward external IPs. This restriction is in place to prevent IP spoofing"。
 *     Vercel 作为最外层边缘（默认部署形态）时，**最左**一项即真实客户端 IP；
 *     官方 `@vercel/functions` 的 `ipAddress()` 也是读这个头。
 *   · `x-real-ip` —— 文档明确 "This header is identical to the x-forwarded-for header"，
 *     同样由平台写入，客户端无法伪造。
 *   · `x-vercel-forwarded-for` —— 文档 "identical to the x-forwarded-for header. However,
 *     x-forwarded-for could be overwritten if you're using a proxy on top of Vercel"，
 *     即**平台之上还挂了代理**时最可信的一个。
 *
 * 顺序取 `x-real-ip` → `x-vercel-forwarded-for` → `x-forwarded-for`：
 * 前两者只有平台会写，最不容易被动过；XFF 殿后既覆盖自建 / 其它 PaaS 的部署场景
 * （那些环境下 XFF 是唯一来源），也仍然符合 Vercel 的"最左即客户端"语义。
 * 每个头都按逗号链拆分，**从左往右取第一个形状合法的值**。
 *
 * ## 为什么必须做形状校验
 *
 * 这个返回值有两处**落库**用途：
 *   · `daily_uv.ip` —— 是联合主键的一半；
 *   · `comment.ip` / `visitor_log.ip` —— `String` 列，**没有长度上界**；
 * 另外还有 7 类限流把它当 key。也就是说，一个"能返回任意字符串"的实现，
 * 等于允许把客户端可控的**任意长度字符串**写进数据库主键、并当作限流维度。
 *
 * 本项目刚经历过一次平台迁移（EdgeOne → Vercel），不能假定"平台一定会注入合法 IP"
 * 这件事永远成立；将来若改用别的托管、或在前面加一层 CDN，注入语义立刻改变。
 * 因此这里只放行形状明确的 IPv4 / IPv6，其余一律跳过、继续看下一个候选。
 *
 * 全部落空时返回 `unknown`：把"解析不出身份"的请求归到**同一个桶**，
 * 这是安全的方向 —— 宁可过度节流，也不能因为取不到 IP 就给出无限配额。
 * （本地开发时三个头都可能缺失，同样走这个兜底。）
 */
const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/**
 * IPv6 的**形状**校验（不追求 RFC 4291 完整文法，那需要引入 `node:net`
 * 而本项目有 Edge runtime 路由）：
 *   · 总长 2–45（IPv6 文本形式的上界是 45，含 IPv4-mapped 后缀）；
 *   · 至少含一个 `:`；
 *   · 只由十六进制字符、`:`、`.` 组成（`.` 用于 `::ffff:1.2.3.4` 这类写法）;
 *   · `::` 最多出现一次、且连续冒号不得超过两个（`::` 是"零压缩"记号，
 *     出现两次或写成 `:::` 即非法）。
 * 足以拒绝空格、斜杠、引号、超长串等所有"把任意字符串塞进来"的用法。
 */
const IPV6 = /^(?=.{2,45}$)(?=.*:)(?!.*::.*::)(?!.*:::)[0-9a-fA-F:.]+$/;

function isIpAddress(value: string): boolean {
  return IPV4.test(value) || IPV6.test(value);
}

/** 候选头，按可信度从高到低。见文件头注释的排序依据。 */
const IP_HEADERS = [
  "x-real-ip",
  "x-vercel-forwarded-for",
  "x-forwarded-for",
] as const;

/** 解析失败时的统一占位 —— 见文件头注释，绝不要改成看起来像真实 IP 的值。 */
const UNKNOWN_IP = "unknown";

export function getClientIp(request: Request): string {
  for (const header of IP_HEADERS) {
    const raw = request.headers.get(header);
    if (!raw) continue;
    for (const candidate of raw.split(",")) {
      const value = candidate.trim();
      if (isIpAddress(value)) return value;
    }
  }
  return UNKNOWN_IP;
}

/* ═══════════════════════════════════════════════════════════════════════
   以下与上面的 IP 解析无关，是通用小工具。
   （放在同一文件是因为这里已是全站"零散纯函数"的落点；若哪天本文件再长出
     一组独立关注点，就应当拆成各自模块。）
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * 转义正则元字符，用于把**用户输入**安全地拼进 `new RegExp(...)`。
 *
 * ⚠️ 全站唯一实现。这类函数漏改一处就会让搜索框输入 `(` 直接抛 `SyntaxError`，
 * 所以不要在各组件里再写一份。
 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
