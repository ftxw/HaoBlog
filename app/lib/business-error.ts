/** 业务错误：调用方能看懂、且要带着指定状态码回给前端的失败。 */
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

/** 令牌确实无效（区别于「上游不可用」）：固定 401，供调用方用类型判断而非比对文案。 */
export class InvalidTokenError extends BusinessError {
  constructor(message = "无效的令牌") {
    super(message, 401);
    this.name = "InvalidTokenError";
  }
}
