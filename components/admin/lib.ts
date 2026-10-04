"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateCN, formatDateTimeCN } from "@/app/lib/format";
import {
  jsonHeadersFor,
  errorText,
} from "@/app/lib/response";
import { unwrapApi } from "@/app/lib/api-types";
import type { ActionResult } from "@/app/lib/action-result";

let refreshing: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch("/api/auth/refresh-token", {
          method: "POST",
          credentials: "same-origin",
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

export async function logoutSession(): Promise<void> {
  invalidateApiCache();
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
  }
}

export function redirectToLogin() {
  logoutSession();
  window.location.href = "/admin/login";
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const doFetch = () =>
    fetch(path, {
      ...init,
      cache: init?.cache ?? "no-store",
      credentials: "same-origin",
      headers: {
        ...jsonHeadersFor(init?.body),
        ...(init?.headers || {}),
      },
    });

  let res = await doFetch();
  if (res.status === 401) {
    const ok = await tryRefreshToken();
    if (ok) {
      res = await doFetch();
    } else {
      redirectToLogin();
      throw new Error("登录已过期，请重新登录");
    }
  }
  return res;
}

const inflightGets = new Map<string, Promise<unknown>>();

export function invalidateApiCache(): void {
  inflightGets.clear();
}

function isDedupableGet(path: string, init?: RequestInit): boolean {
  return (init?.method || "GET").toUpperCase() === "GET" && !init?.body && Boolean(path);
}

export async function apiJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const dedupe = isDedupableGet(path, init);

  if (dedupe) {
    const pending = inflightGets.get(path);
    if (pending) return pending as Promise<T>;
  }

  const promise = (async () => {
    const res = await apiFetch(path, init ?? {});
    if (!res.ok) {
      throw new Error(await errorText(res));
    }
    const data = unwrapApi<T>(await res.json(), res.status);
    if (!dedupe) invalidateApiCache();
    return data;
  })();

  if (dedupe) {
    inflightGets.set(path, promise);
    promise.then(
      () => inflightGets.delete(path),
      () => inflightGets.delete(path)
    );
  }

  return promise;
}

export async function runAction<T>(promise: Promise<ActionResult<T>>): Promise<T> {
  const result = await promise;
  if (result.ok) {
    invalidateApiCache();
    return result.data;
  }
  if (result.status === 401) {
    redirectToLogin();
  }
  throw new Error(result.message);
}

export function useApi<T = unknown>(url: string | null, initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const servedRef = useRef<string | null>(initial !== null ? `${url}#0` : null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const reqKey = `${url}#${tick}`;
    if (servedRef.current === reqKey) return;
    servedRef.current = reqKey;
    apiJson<T>(url)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  const loading = url !== null && data === null && error === null;

  return { data, loading, error, reload, setData };
}

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : formatDateTimeCN(d);
}

export function formatDateOnly(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : formatDateCN(d);
}

const MAX_THUMB_WIDTH = 640;

async function createThumbBlob(file: File): Promise<Blob | null> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return null;
  try {
    const bmp = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_THUMB_WIDTH / bmp.width);
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0, w, h);
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.85)
      );
    } finally {
      bmp.close();
    }
  } catch {
    return null;
  }
}

interface PresignData {
  key: string;
  url: string;
  uploadUrl: string;
  thumbKey: string;
  thumbUrl: string;
  thumbUploadUrl: string;
  expiresIn: number;
}

async function probeImageSize(file: File): Promise<{
  width: number | null;
  height: number | null;
  orientation: string;
}> {
  try {
    const bmp = await createImageBitmap(file);
    try {
      if (!bmp.width || !bmp.height) {
        return { width: null, height: null, orientation: "landscape" };
      }
      return {
        width: bmp.width,
        height: bmp.height,
        orientation: bmp.height > bmp.width ? "portrait" : "landscape",
      };
    } finally {
      bmp.close();
    }
  } catch {
    return { width: null, height: null, orientation: "landscape" };
  }
}

async function putToS3(url: string, blob: Blob): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": blob.type || "application/octet-stream" },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `图床直传失败 HTTP ${res.status}${detail ? `：${detail.slice(0, 200)}` : ""}`
    );
  }
}

interface UploadImageOptions {
  category?: string;
  folder?: string;
}

export async function uploadImage(
  file: File,
  opts: UploadImageOptions = {}
): Promise<{
  url: string;
  thumbUrl: string;
  orientation: string;
  width: number | null;
  height: number | null;
}> {
  const thumbBlob =
    opts.category === "system" ? null : await createThumbBlob(file);
  const dims = await probeImageSize(file);

  let directError = "";
  try {
    const data = await apiJson<PresignData>("/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({
        category: opts.category,
        folder: opts.folder,
        contentType: file.type,
        withThumb: Boolean(thumbBlob),
      }),
    });
    if (!data?.uploadUrl) throw new Error("预签名返回不完整");

    await putToS3(data.uploadUrl, file);
    if (thumbBlob && data.thumbUploadUrl) {
      try {
        await putToS3(data.thumbUploadUrl, thumbBlob);
      } catch (e) {
        console.warn("[upload] 缩略图直传失败（不影响主图）:", e);
      }
    }
    return {
      url: data.url,
      thumbUrl: data.thumbUrl || "",
      orientation: dims.orientation,
      width: dims.width,
      height: dims.height,
    };
  } catch (e) {
    directError = e instanceof Error ? e.message : String(e);
    console.warn("[upload] 浏览器直传不可用，回退服务端中转:", e);
  }

  const formData = new FormData();
  formData.append("file", file);
  if (opts.category) formData.append("category", opts.category);
  if (opts.folder) formData.append("folder", opts.folder);
  if (thumbBlob) {
    const base = file.name.replace(/\.[^/.]+$/, "");
    formData.append("thumb", thumbBlob, `${base}.webp`);
  }
  const res = await apiFetch("/api/upload/image", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const reason = await errorText(res);
    throw new Error(
      directError ? `${reason}（浏览器直传也不可用：${directError}）` : reason
    );
  }
  const json = unwrapApi<{
    url: string;
    thumbUrl?: string;
    orientation?: string;
    width?: number | null;
    height?: number | null;
  } | null>(await res.json().catch(() => null), res.status);
  if (!json?.url) throw new Error("图片上传返回不完整");
  return {
    url: json.url,
    thumbUrl: json.thumbUrl || "",
    orientation: json.orientation || dims.orientation,
    width: typeof json.width === "number" ? json.width : dims.width,
    height: typeof json.height === "number" ? json.height : dims.height,
  };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
