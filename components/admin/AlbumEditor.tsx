"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, apiJson, runAction, uploadImage, formatDate } from "@/components/admin/lib";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import { formatDateCN } from "@/app/lib/format";
import {
  Button,
  Sheet,
  SheetHeader,
  Section,
  PageHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";
import DateWheelPicker from "@/components/ui/DateWheelPicker";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";
import {
  createAlbumAction,
  createPhotoAction,
  deletePhotoAction,
  reorderPhotosAction,
  updateAlbumAction,
  updatePhotoAction,
} from "@/app/actions/albums";
import type { PhotoItem } from "@/app/lib/queries/albums";

interface AlbumDetail {
  id: string;
  title: string;
  description: string;
  cover: string;
  layout: string;
  sort: number;
  photo_count: number;
  created_at: string;
  updated_at: string | null;
  published_at: string | null;
  photos: PhotoItem[];
}

function SortablePhoto({
  photo,
  isCover,
  onSetCover,
  onEdit,
  onDelete,
}: {
  photo: PhotoItem;
  isCover: boolean;
  onSetCover: (photo: PhotoItem) => void;
  onEdit: (photo: PhotoItem) => void;
  onDelete: (photo: PhotoItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative cursor-grab overflow-hidden rounded-lg border border-admin-border bg-admin-surface-muted active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrlOf(photo.url)}
        alt={photo.caption || "photo"}
        loading="lazy"
        decoding="async"
        onError={(e) => fallbackThumbToOriginal(e.currentTarget, photo.url)}
        className="aspect-square w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-xs text-white">
          {photo.caption || formatDateCN(new Date(photo.taken_at)) || "无说明"}
        </p>
      </div>
      <button type="button"
        title={isCover ? "当前封面，点击取消" : "设为封面"}
        onClick={() => onSetCover(photo)}
        className={cn(
          "absolute left-1.5 top-1.5 z-10 rounded-md p-1 transition-opacity cursor-pointer",
          isCover
            ? "bg-admin-accent text-admin-accent-ink opacity-100"
            : "bg-admin-overlay text-admin-ink-3 opacity-0 hover:text-admin-accent group-hover:opacity-100"
        )}
      >
        <Pin className={cn("h-3.5 w-3.5", isCover && "fill-current")} />
      </button>
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button"
          title="编辑信息"
          onClick={() => onEdit(photo)}
          className="rounded-md bg-admin-overlay p-1 text-admin-ink-3 hover:text-admin-accent cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button"
          title="删除照片"
          onClick={() => onDelete(photo)}
          className="rounded-md bg-admin-overlay p-1 text-admin-ink-3 hover:text-admin-danger cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return formatDateCN(d);
}

export default function AlbumEditor({ albumId }: { albumId?: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [currentId, setCurrentId] = useState<string | undefined>(albumId);
  const isNew = !currentId;
  const [loading, setLoading] = useState(Boolean(albumId));
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [layout, setLayout] = useState("grid");
  const [photoCount, setPhotoCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoEdit, setPhotoEdit] = useState<PhotoItem | null>(null);
  const [photoForm, setPhotoForm] = useState({ caption: "", taken_at: "" });
  const [photoSaving, setPhotoSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const applyAlbum = useCallback((album: AlbumDetail) => {
    setTitle(album.title);
    setDescription(album.description || "");
    setCover(album.cover || "");
    setLayout(album.layout || "grid");
    setPhotoCount(album.photo_count);
    setUpdatedAt(album.updated_at);
    setPublishedAt(toDateInputValue(album.published_at));
    setPhotos(album.photos || []);
  }, []);

  const loadAlbum = useCallback(
    async (id?: string) => {
      const aid = id ?? currentId;
      if (!aid) return;
      const album = await apiJson<AlbumDetail>(`/api/albums/${aid}`);
      applyAlbum(album);
    },
    [currentId, applyAlbum]
  );

  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    apiJson<AlbumDetail>(`/api/albums/${currentId}`)
      .then((album) => {
        if (!cancelled) applyAlbum(album);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        addToast("error", e.message);
        router.replace("/admin/albums");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentId, applyAlbum, addToast, router]);

  const saveAlbum = async () => {
    if (!title.trim()) {
      addToast("warning", "请填写相册标题");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        cover,
        layout,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
      };
      if (currentId) {
        await runAction(updateAlbumAction(currentId, payload));
        addToast("success", "相册已保存");
        await loadAlbum();
      } else {
        const album = await runAction(createAlbumAction(payload));
        addToast("success", "相册已创建");
        setCurrentId(album.id);
        router.replace(`/admin/albums/${album.id}`);
      }
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const ensureAlbum = async (): Promise<string> => {
    if (currentId) return currentId;
    const album = await runAction(
      createAlbumAction({
        title: title.trim() || "未命名相册",
        description,
        cover,
        layout,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
      })
    );
    setCurrentId(album.id);
    return album.id;
  };

  const handleUploadPhotos = async (files: FileList) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setPhotoUploading(true);
    try {
      const aid = await ensureAlbum();
      let sortIdx = photos.length;
      for (const file of list) {
        const { url, width, height } = await uploadImage(file, {
          category: "photowall",
          folder: String(aid),
        });
        const caption = file.name.replace(/\.[^/.]+$/, "");
        await runAction(
          createPhotoAction({
            album_id: aid,
            url,
            caption,
            w: width ?? undefined,
            h: height ?? undefined,
            sort: sortIdx++,
          })
        );
      }
      addToast("success", `已上传 ${list.length} 张照片`);
      await loadAlbum(aid);
      if (!albumId) router.replace(`/admin/albums/${aid}`);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "上传失败");
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const savePhoto = async () => {
    if (!photoEdit) return;
    setPhotoSaving(true);
    try {
      await runAction(
        updatePhotoAction(photoEdit.id, {
          caption: photoForm.caption,
          taken_at: photoForm.taken_at || undefined,
        })
      );
      addToast("success", "照片信息已更新");
      setPhotoEdit(null);
      await loadAlbum();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setPhotoSaving(false);
    }
  };

  const deletePhoto = async (photo: PhotoItem) => {
    const ok = await confirm("删除照片", "确定删除这张照片？");
    if (!ok) return;
    try {
      await runAction(deletePhotoAction(photo.id));
      addToast("success", "照片已删除");
      await loadAlbum();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  const setAsCover = async (photo: PhotoItem) => {
    if (!currentId) return;
    const isCurrent = cover === photo.url;
    try {
      await runAction(
        updateAlbumAction(currentId, { cover: isCurrent ? "" : photo.url })
      );
      const prevCover = cover;
      const nextCover = isCurrent ? "" : photo.url;
      setCover(nextCover);
      addToast("success", isCurrent ? "已取消封面" : "已设置为封面");
      if (
        prevCover &&
        prevCover !== nextCover &&
        !photos.some((p) => p.url === prevCover)
      ) {
        try {
          await apiFetch(
            `/api/upload/image?url=${encodeURIComponent(prevCover)}`,
            { method: "DELETE" }
          );
        } catch {
        }
      }
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  const commitReorder = async (ids: string[]) => {
    try {
      await runAction(reorderPhotosAction({ album_id: currentId, ids }));
      addToast("success", "排序已更新");
      await loadAlbum();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      await loadAlbum();
    }
  };

  const {
    ids: sortIds,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    strategy,
  } = useDragSort<PhotoItem>({
    items: photos,
    onReorder: (nextIds) => setPhotos((prev) => reorderItemsByIds(prev, nextIds)),
    onCommit: commitReorder,
    strategy: "rect",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-admin-ink-5">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">加载相册中…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? "新建相册" : "编辑相册"}
        description={updatedAt ? `最后更新于 ${formatDate(updatedAt)}` : "填写内容后保存"}
        actions={
          <>
            <Button variant="secondary" onClick={() => router.back()}>
              返回
            </Button>
            <Button onClick={saveAlbum} loading={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-4">
          <Sheet>
            <SheetHeader title="基本信息" />
            <Section>
              <div className="space-y-4">
                <Field label="标题" required>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="相册标题"
                  />
                </Field>
                <Field label="简介">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="相册简介（可选）"
                  />
                </Field>
              </div>
            </Section>
          </Sheet>

          <Sheet>
            <SheetHeader
              title="照片列表"
              description={`${photoCount} 张照片，按 sort 升序展示`}
              actions={
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      e.target.files && handleUploadPhotos(e.target.files)
                    }
                  />
                  <Button
                    onClick={() => photoInputRef.current?.click()}
                    loading={photoUploading}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {photoUploading ? "上传中…" : "上传照片"}
                  </Button>
                </>
              }
            />

            {photos.length === 0 ? (
              <EmptyState
                text={
                  currentId
                    ? "该相册还没有照片"
                    : "还没有照片，未保存的相册会在首次上传时自动创建"
                }
                hint="支持多选批量上传，拖拽可调整顺序"
              />
            ) : (
              <div className="p-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext items={sortIds} strategy={strategy}>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                      {photos.map((photo) => (
                        <SortablePhoto
                          key={photo.id}
                        photo={photo}
                        isCover={photo.url === cover}
                        onSetCover={setAsCover}
                        onEdit={(p) => {
                          setPhotoEdit(p);
                          setPhotoForm({
                            caption: p.caption || "",
                            taken_at: toDateInputValue(p.taken_at),
                          });
                        }}
                        onDelete={deletePhoto}
                      />
                    ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </Sheet>
        </div>

        <div className="space-y-4">
          <Sheet>
            <SheetHeader title="发布与展示" />
            <Section>
              <div className="space-y-4">
            <Field label="设置时间" hint="未设置时按最近更新时间显示">
              <DateWheelPicker
                value={publishedAt}
                onChange={setPublishedAt}
                placeholder="未设置"
              />
            </Field>
            <Field label="布局">
              <Select value={layout} onChange={(e) => setLayout(e.target.value)}>
                <option value="grid">网格瀑布流</option>
                <option value="timeline">时间轴</option>
              </Select>
            </Field>
              </div>
            </Section>
          </Sheet>

          <Sheet>
            <SheetHeader title="封面图片" />
            <Section>
            <ImageUploader
              mode="single"
              value={cover}
              onChange={(urls) => setCover(urls[0] || "")}
              height="h-40"
              category="photowall"
              folder={currentId ? String(currentId) : undefined}
              canDeleteImage={(url) => !photos.some((p) => p.url === url)}
            />
            <p className="mt-2 text-xs text-admin-ink-5">
              可上传新图，也可在照片列表中把某张照片设为封面
            </p>
            </Section>
          </Sheet>
        </div>
      </div>

      <Modal
        open={Boolean(photoEdit)}
        title="编辑照片信息"
        onClose={() => setPhotoEdit(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPhotoEdit(null)}>
              取消
            </Button>
            <Button onClick={savePhoto} loading={photoSaving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {photoEdit && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoEdit.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="max-h-52 w-full rounded-lg border border-admin-border object-contain"
            />
          )}
          <Field label="照片说明">
            <Input
              value={photoForm.caption}
              onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
              placeholder="照片说明（可选）"
            />
          </Field>
          <Field label="拍摄日期" hint="时间轴视图按此日期分组">
            <DateWheelPicker
              value={photoForm.taken_at}
              onChange={(v) => setPhotoForm({ ...photoForm, taken_at: v })}
              placeholder="未设置"
            />
          </Field>
        </div>
      </Modal>

      {confirmElement}
    </div>
  );
}
