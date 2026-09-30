import { NextRequest } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok } from "@/app/lib/http";
import { getS3ImageHostConfig, probeS3 } from "@/app/lib/s3-image-host";

/**
 * 图床连通性自检（仅管理员）。
 *
 * 用法：登录后台后，浏览器直接打开 `/api/admin/s3-diagnose`。
 *
 * 存在的理由：上传报 AbortError / TimeoutError 时，光看错误文本分不清是
 * 「配置填错了」还是「网络根本不通 / 太慢」—— 两者的处理方式完全不同。
 * 这里让**服务器自己**去连一次图床，把结论直接给出来：
 *   - 很快返回 403 / InvalidAccessKeyId → 密钥或桶名不对
 *   - 很快返回 NoSuchBucket            → 桶不存在
 *   - 卡满超时才失败                    → 网络层不通（DNS / 被墙 / 地域或 IP 限制），
 *                                        调大超时也没用
 *   - ok 但耗时很大                     → 能通，但链路很慢，大图必须降采样才传得动
 *
 * 安全：只回显 endpoint 的 scheme+host（不含路径/查询），且绝不回显密钥。
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return businessFail(err);
  }

  const cfg = await getS3ImageHostConfig();

  let endpointHost = "";
  try {
    const u = new URL(cfg.endpoint);
    endpointHost = `${u.protocol}//${u.host}`;
  } catch {
    endpointHost = cfg.endpoint ? "(无法解析为 URL)" : "";
  }

  const configured = Boolean(
    cfg.endpoint && cfg.bucket && cfg.accessKey && cfg.secretKey
  );

  const probe = configured ? await probeS3() : null;

  return ok({
    configured,
    endpointHost,
    bucket: cfg.bucket,
    region: cfg.region || "(默认)",
    directCdn: cfg.imageCdnDomain || null,
    probe,
    hint: !configured
      ? "图床未配置：请在后台「站点配置 → 图床设置」填写 endpoint / bucket / accessKey / secretKey。"
      : probe?.ok
      ? probe.ms > 3000
        ? `图床可连通，但往返耗时 ${probe.ms}ms，链路较慢 —— 大图请依赖前端降采样后上传。`
        : `图床可连通（往返 ${probe.ms}ms）。`
      : `连不上：${probe?.errorName || "未知"}（耗时 ${probe?.ms ?? "-"}ms）。` +
        (probe && probe.ms >= 14000
          ? " 卡满超时才失败，通常是网络层不通（DNS 失败 / 端口被挡 / 地域或 IP 限制），调大超时无济于事。"
          : " 快速失败，通常是配置问题（密钥、桶名、区域）。"),
  });
}
