import { createHash, createHmac } from "node:crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
const OPERATION_ID = "PutObject";
const DEFAULT_EXPIRES_SEC = 900;
const DEFAULT_REGION = "us-east-1";

export interface PresignParams {
  endpoint: string;
  bucket: string;
  key: string;
  region: string;
  accessKey: string;
  secretKey: string;
  expiresIn?: number;
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function awsUriEncode(value: string, encodeSlash: boolean): string {
  const encoded = encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return encodeSlash ? encoded : encoded.replace(/%2F/g, "/");
}

function canonicalQueryString(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map((k) => `${awsUriEncode(k, true)}=${awsUriEncode(query[k], true)}`)
    .join("&");
}

function amzTimestamp(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

export function presignPutUrl(params: PresignParams): string {
  const { endpoint, bucket, key, accessKey, secretKey } = params;
  const region = params.region || DEFAULT_REGION;
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error(
      "预签名失败：图床 endpoint / bucket / accessKey / secretKey 未配置完整"
    );
  }

  const url = new URL(endpoint);
  const basePath = url.pathname.replace(/\/+$/, "");
  const canonicalUri = `${basePath}/${awsUriEncode(bucket, false)}/${awsUriEncode(
    key,
    false
  )}`;

  const amzDate = amzTimestamp(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Content-Sha256": UNSIGNED_PAYLOAD,
    "X-Amz-Credential": `${accessKey}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(params.expiresIn ?? DEFAULT_EXPIRES_SEC),
    "X-Amz-SignedHeaders": "host",
    "x-id": OPERATION_ID,
  };
  const canonicalQuery = canonicalQueryString(query);
  const canonicalHeaders = `host:${url.host}\n`;

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    UNSIGNED_PAYLOAD,
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  query["X-Amz-Signature"] = signature;
  return `${url.protocol}//${url.host}${canonicalUri}?${canonicalQueryString(query)}`;
}
