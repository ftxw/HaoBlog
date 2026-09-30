/**
 * 业务错误：**调用方能看懂、且要带着指定状态码回给前端**的失败。
 *
 * 背景：项目里的失败分两类 ——
 *   · 业务校验失败（「分类已存在」「名称和链接不能为空」）需要把原文透给用户，
 *     并带上 400 / 404 / 409 这类语义化状态码；
 *   · 其他异常（Prisma / Supabase 的原始报错）在生产必须被 `safeErrMessage` 换成固定文案，
 *     否则会把表名、约束名、连接串片段泄露给调用方（审计 R1 / R2）。
 *
 * `app/lib/mutations/*` 不直接造响应，而是用这个错误类携带「原文 + 状态码」，
 * 由 `app/lib/http.ts` 的 `errorStatus` / `safeErrMessage` 统一还原成响应。
 */
export class BusinessError extends Error {
  readonly status: number;

  readonly headers?: Record<string, string>;

  constructor(message: string, status = 400, headers?: Record<string, string>) {
    super(message);
    this.name = "BusinessError";
    this.status = status;
    this.headers = headers;
  }
}
