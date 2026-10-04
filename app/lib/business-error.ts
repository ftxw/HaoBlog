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

export class InvalidTokenError extends BusinessError {
  constructor(message = "无效的令牌") {
    super(message, 401);
    this.name = "InvalidTokenError";
  }
}
