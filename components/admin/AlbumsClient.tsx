"use client";

import { useRouter } from "next/navigation";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CirclePlus, GripVertical, Images, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDateOnly, runAction, useApi } from "@/components/admin/lib";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import {
  Card,
  EmptyState,
  Loading,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import { ListToolbar, ToolbarAction } from "@/components/admin/ContentListShell";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";
import {
  deleteAlbumAction,
  reorderAlbumsAction,
} from "@/app/actions/albums";
import type { AlbumItem } from "@/app/lib/queries/albums";

function SortableAlbumCard({
  album,
  onOpen,
  onDelete,
}: {
  album: AlbumItem;
  onOpen: (id: string) => void;
  onDelete: (album: AlbumItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: album.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group cursor-pointer", isDragging && "relative z-10")}
      onClick={() => onOpen(album.id)}
      {...attributes}
      {...listeners}
    >
      <Card
        className={cn(
          "relative flex flex-col overflow-hidden",
          isDragging && "opacity-70 ring-2 ring-inset ring-admin-accent-ring"
        )}
      >
        <div className="aspect-video w-full overflow-hidden bg-admin-neutral">
          {album.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrlOf(album.cover)}
              alt={album.title}
              loading="lazy"
              decoding="async"
              onError={(e) => fallbackThumbToOriginal(e.currentTarget, album.cover)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-admin-ink-none">
              <Images className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-3">
          <p className="truncate font-medium text-admin-ink">{album.title}</p>
          {album.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-admin-ink-4">
              {album.description}
            </p>
          ) : null}
          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <p className="truncate text-xs text-admin-ink-5">
              {album.photo_count} 张照片 ·{" "}
              {album.layout === "timeline" ? "时间轴" : "网格"}
            </p>
            <p className="shrink-0 text-xs text-admin-ink-5">
              {formatDateOnly(album.published_at || album.updated_at)}
            </p>
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-admin-overlay text-admin-ink-4 shadow-sm"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button"
            title="编辑相册"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(album.id);
            }}
            className="rounded-md bg-admin-overlay p-1 text-admin-ink-3 hover:text-admin-accent cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button"
            title="删除相册"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(album);
            }}
            className="rounded-md bg-admin-overlay p-1 text-admin-ink-3 hover:text-admin-danger cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>
    </div>
  );
}

export default function AlbumsClient({
  initialAlbums,
}: {
  initialAlbums: AlbumItem[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const albums = useApi<AlbumItem[]>("/api/albums", initialAlbums);
  const items = albums.data ?? [];

  const deleteAlbum = async (album: AlbumItem) => {
    const ok = await confirm(
      "删除相册",
      `确定删除相册「${album.title}」及其全部 ${album.photo_count} 张照片？`
    );
    if (!ok) return;
    try {
      await runAction(deleteAlbumAction(album.id));
      addToast("success", "相册已删除");
      albums.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  const commitReorder = async (ids: string[]) => {
    try {
      await runAction(reorderAlbumsAction({ ids }));
      addToast("success", "排序已更新");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      albums.reload();
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
  } = useDragSort<AlbumItem>({
    items,
    onReorder: (nextIds) =>
      albums.setData((prev) =>
        Array.isArray(prev) ? reorderItemsByIds(prev, nextIds) : prev
      ),
    onCommit: commitReorder,
    strategy: "rect",
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-admin-accent">摄影图库</h1>
      </div>

      <ListToolbar
        actions={
          <ToolbarAction
            icon={<CirclePlus className="h-4 w-4" />}
            label="新建相册"
            onClick={() => router.push("/admin/albums/new")}
          />
        }
      >
        <span className="text-sm text-admin-ink-4">
          共 {items.length} 个相册 · 拖拽卡片手柄可排序
        </span>
      </ListToolbar>

      {albums.loading && !albums.data ? (
        <Card>
          <Loading />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState text="暂无相册，点击右上角「新建相册」创建" />
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortIds} strategy={strategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((album) => (
                <SortableAlbumCard
                  key={album.id}
                  album={album}
                  onOpen={(id) => router.push(`/admin/albums/${id}`)}
                  onDelete={deleteAlbum}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {confirmElement}
    </>
  );
}
