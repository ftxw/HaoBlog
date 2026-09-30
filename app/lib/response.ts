
/** 根据请求体决定是否注入 JSON Content-Type（FormData/无 body 不加） */
export function jsonHeadersFor(body: unknown): Record<string, string> {
  if (body === undefined || body === null) return {};
  if (typeof FormData !== "undefined" && body instanceof FormData) return {};
  return { "Content-Type": "application/json" };
}

/**
 * 从非 2xx 响应里取出人类可读的错误文案。
 * 信封（`{ code, message, data }`）走 JSON；music/lyrics、music/stream 等流式接口回纯文本，
 * 故 JSON 解析失败后再试一次 text（用 clone 避免 body 被前一次读走）。
 */
export async function errorText(res: Response): Promise<string> {
  const fallback = `请求失败（${res.status}）`;
  try {
    const json = (await res.clone().json()) as { message?: unknown } | null;
    const msg = json?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  } catch {
  }
  try {
    const text = (await res.text()).trim();
    if (text) return text.slice(0, 300);
  } catch {
  }
  return fallback;
}
