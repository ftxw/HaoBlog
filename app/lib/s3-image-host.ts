import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getDbSiteConfig } from "@/app/lib/site-config-db";
import { normalizeCdnDomain } from "@/app/lib/image-thumb";

const DEFAULT_REGION = "us-east-1";

const S3_TIMEOUT_MS = 5_000;

const S3_MAX_ATTEMPTS = 2;

export interface S3ImageHostConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  imageCdnDomain: string;
}

export async function getS3ImageHostConfig(): Promise<S3ImageHostConfig> {
  const cfg = await getDbSiteConfig();
  const pick = (key: string) => cfg[key] || "";
  return {
    endpoint: pick("endpoint"),
    bucket: pick("bucket"),
    accessKey: pick("accessKey"),
    secretKey: pick("secretKey"),
    region: pick("region"),
    imageCdnDomain: normalizeCdnDomain(pick("imageCdnDomain")),
  };
}

export async function isS3Configured(): Promise<boolean> {
  const cfg = await getS3ImageHostConfig();
  return Boolean(cfg.endpoint && cfg.bucket && cfg.accessKey && cfg.secretKey);
}

function createClient(cfg: S3ImageHostConfig): S3Client {
  return new S3Client({
    region: cfg.region || DEFAULT_REGION,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    maxAttempts: S3_MAX_ATTEMPTS,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
  });
}

type S3Command = PutObjectCommand | GetObjectCommand | DeleteObjectCommand;

async function send(client: S3Client, command: S3Command) {
  return client.send(command, {
    abortSignal: AbortSignal.timeout(S3_TIMEOUT_MS),
  });
}

function configFingerprint(cfg: S3ImageHostConfig): string {
  return [cfg.endpoint, cfg.bucket, cfg.accessKey, cfg.secretKey, cfg.region].join(
    "|"
  );
}

let cachedClient: S3Client | null = null;
let cachedFingerprint = "";

async function getClient(): Promise<S3Client> {
  const cfg = await getS3ImageHostConfig();
  const fp = configFingerprint(cfg);
  if (!cachedClient || cachedFingerprint !== fp) {
    cachedClient = createClient(cfg);
    cachedFingerprint = fp;
  }
  return cachedClient;
}

export function generateFileName(ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}.${ext}`;
}

export function thumbKeyOf(key: string): string {
  const idx = key.lastIndexOf("/");
  if (idx === -1) return `thumb/${key}`;
  return `${key.slice(0, idx)}/thumb/${key.slice(idx + 1)}`;
}

export interface S3UploadResult {
  url: string;
  key: string;
}

export function imageUrlOf(key: string, cfg: S3ImageHostConfig): string {
  return cfg.imageCdnDomain
    ? `${cfg.imageCdnDomain}/${key}`
    : `/api/img-proxy/imgs/${key}`;
}

export async function uploadImageToS3(
  fileBuffer: ArrayBuffer,
  filename: string,
  contentType: string
): Promise<S3UploadResult> {
  const cfg = await getS3ImageHostConfig();
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKey || !cfg.secretKey) {
    throw new Error(
      "S3 图床未配置：请在后台「站点配置 → 图床设置」填写 endpoint / bucket / accessKey / secretKey"
    );
  }
  const key = filename;
  const client = await getClient();
  await send(
    client,
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: new Uint8Array(fileBuffer),
      ContentType: contentType,
    })
  );
  return { url: imageUrlOf(key, cfg), key };
}

const reportedReadErrors = new Set<string>();

export async function getImageFromS3(key: string): Promise<{
  body: ReadableStream | null;
  contentType: string;
} | null> {
  try {
    const cfg = await getS3ImageHostConfig();
    if (!cfg.bucket) return null;
    const client = await getClient();
    const obj = await send(
      client,
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key })
    ) as { Body?: unknown; ContentType?: string };
    if (!obj.Body) return null;
    return {
      body: obj.Body as unknown as ReadableStream,
      contentType: obj.ContentType || "application/octet-stream",
    };
  } catch (e) {
    const err = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    const status = err?.$metadata?.httpStatusCode;
    const isNotFound =
      status === 404 || err?.name === "NoSuchKey" || err?.name === "NotFound";

    if (!isNotFound) {
      const signature = `${err?.name || "Unknown"}:${status ?? "-"}`;
      if (!reportedReadErrors.has(signature)) {
        reportedReadErrors.add(signature);
        console.error(
          `[s3-image-host] 读取对象失败（非「不存在」类错误，可能是图床配置/网络问题）key=${key}`,
          err?.message || e
        );
      }
    }
    return null;
  }
}

export async function deleteImageFromS3(key: string): Promise<boolean> {
  try {
    const cfg = await getS3ImageHostConfig();
    if (!cfg.bucket) return false;
    const client = await getClient();
    await send(client, new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return true;
  } catch (e) {
    console.warn("[s3-image-host] 删除失败:", (e as Error).message);
    return false;
  }
}

export async function deleteImageByUrl(
  imageUrl: string,
  key?: string
): Promise<boolean> {
  let k = key || null;
  if (!k) {
    const proxyMatch = imageUrl.match(/\/api\/img-proxy\/imgs\/(.+)$/);
    if (proxyMatch) k = proxyMatch[1];
    else {
      const cfg = await getS3ImageHostConfig().catch(() => null);
      const domain = cfg?.imageCdnDomain;
      if (domain && imageUrl.startsWith(`${domain}/`)) {
        k = imageUrl.slice(domain.length + 1);
      }
    }
  }
  if (!k) return false;
  const results = await Promise.allSettled([
    deleteImageFromS3(k),
    deleteImageFromS3(thumbKeyOf(k)),
  ]);
  return results[0].status === "fulfilled" && results[0].value;
}

const DELETE_CONCURRENCY = 8;

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<unknown>
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        await fn(items[idx]);
      } catch {
      }
    }
  });
  await Promise.all(workers);
}

export async function deleteImagesByUrls(
  urls: string[],
  keyOf?: (url: string) => string | undefined
): Promise<number> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return 0;

  let keyMap = new Map<string, string>();
  try {
    const { prisma } = await import("./prisma");
    const recs = await prisma.imageUpload.findMany({
      where: { url: { in: unique } },
      select: { url: true, asset_id: true },
    });
    keyMap = new Map(recs.map((r) => [r.url, r.asset_id]));
  } catch (e) {
    console.warn("[s3-image-host] 查询 image_upload 失败，按 URL 提取 key:", e);
  }

  let deleted = 0;
  await mapLimit(unique, DELETE_CONCURRENCY, async (url) => {
    const key = keyOf?.(url) || keyMap.get(url) || undefined;
    if (await deleteImageByUrl(url, key)) deleted += 1;
  });
  return deleted;
}

export function extractImageUrlsFromContent(content: string): string[] {
  const urls: string[] = [];
  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/gi,
    /!\[[^\]]*\]\(([^)\s]+)\)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      const u = m[1];
      if (/^https?:\/\//i.test(u)) urls.push(u);
    }
  }
  return urls;
}
