"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { apiFetch, uploadImage, mapWithConcurrency } from "@/components/admin/lib";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import { cn } from "@/components/admin/ui";

export default function ImageUploader({
  mode = "single",
  value,
  onChange,
  onOrientation,
  className,
  height = "h-28",
  square = false,
  canDeleteImage,
  category,
  folder,
  folderResolver,
}: {
  mode?: "single" | "multi";
  value: string | string[];
  onChange: (value: string[]) => void;
  onOrientation?: (orientation: string) => void;
  className?: string;
  height?: string;
  square?: boolean;
  canDeleteImage?: (url: string) => boolean;
  category?: string;
  folder?: string;
  folderResolver?: () => Promise<string | undefined>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteHostedImage = async (url: string) => {
    if (canDeleteImage && !canDeleteImage(url)) return;
    try {
      await apiFetch(`/api/upload/image?url=${encodeURIComponent(url)}`, {
        method: "DELETE",
      });
    } catch {
    }
  };

  const images = mode === "single" ? (value ? [value as string] : []) : (value as string[]);

  const isSystemImage = category === "system";

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const resolvedFolder = folderResolver ? await folderResolver() : folder;
      const results = await mapWithConcurrency(list, 3, (file) =>
        uploadImage(file, { category, folder: resolvedFolder })
      );
      const urls: string[] = [];
      let lastOrientation = "landscape";
      for (const result of results) {
        urls.push(result.url);
        lastOrientation = result.orientation;
      }
      if (mode === "single") {
        const prev = images[0];
        onChange(urls.slice(0, 1));
        onOrientation?.(lastOrientation);
        if (prev && prev !== urls[0]) deleteHostedImage(prev);
      } else {
        onChange([...images, ...urls]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => {
    onChange(images.filter((u) => u !== url));
    deleteHostedImage(url);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (mode !== "single") return;
    const files = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) {
      e.preventDefault();
      await handleFiles(files);
    }
  };

  return (
    <div className={cn("space-y-2", className)} onPaste={handlePaste}>
      <div className={cn("flex flex-wrap gap-2", height)}>
        {images.map((url) => (
          <div
            key={url}
            className={cn(
              "group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50",
              height,
              mode === "single" ? (square ? "w-28" : "w-full") : "w-28"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isSystemImage ? url : thumbUrlOf(url)}
              alt="preview"
              onError={
                isSystemImage
                  ? undefined
                  : (e) => fallbackThumbToOriginal(e.currentTarget, url)
              }
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {(mode === "multi" || images.length === 0) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-indigo-400 hover:text-indigo-500 cursor-pointer",
              height,
              mode === "single" && (square ? "w-28" : "w-full")
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">上传中…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">
                  {mode === "single" ? "点击或粘贴上传" : "点击上传"}
                </span>
              </>
            )}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        multiple={mode === "multi"}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
