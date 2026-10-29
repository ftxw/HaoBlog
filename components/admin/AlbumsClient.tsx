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
  Sheet,
  PageHeader,
  Button,
  EmptyState,
  Loading,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import { ListToolbar } from "@/components/admin/ContentListShell";
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
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border border-admin-border bg-admin-surface transition-all hover:border-admin-border-control hover:shadow-sm",
        isDragging && "z-10 opacity-70 ring-2 ring-admin-accent-ring"
      )}
      onClick={() => onOpen(album.id)}
      {...attributes}
      {...listeners}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-admin-neutral">
        {album.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrlOf(album.cover)}
            alt={album.title}
            loading="lazy"
            decoding="async"
            onError={(e) => fallbackThumbToOriginal(e.currentTarget, album.cover)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-admin-ink-none">
            <Images className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-[13px] font-medium text-admin-ink">
          {album.title}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-admin-ink-4">
          <span className="truncate tabular-nums">
            {album.photo_count} 张 · {album.layout === "timeline" ? "时间轴" : "网格"}
          </span>
          <span className="shrink-0 tabular-nums">
            {formatDateOnly(album.published_at || album.updated_at)}
          </span>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-admin-overlay text-admin-ink-4 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="编辑相册"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(album.id);
          }}
          className="cursor-pointer rounded-md bg-admin-overlay p-1 text-admin-ink-3 shadow-sm hover:text-admin-accent"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="删除相册"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(album);
          }}
          className="cursor-pointer rounded-md bg-admin-overlay p-1 text-admin-ink-3 shadow-sm hover:text-admin-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
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
      <PageHeader
        title="摄影图库"
        description="按相册组织照片，支持拖拽调整顺序"
        actions={
          <Button onClick={() => router.push("/admin/albums/new")}>
            <CirclePlus className="h-3.5 w-3.5" />
            新建相册
          </Button>
        }
      />

      <Sheet>
        <ListToolbar>
          <span className="text-xs text-admin-ink-4">
            共 {items.length} 个相册 · 拖拽卡片可排序
          </span>
        </ListToolbar>

        {albums.loading && !albums.data ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState
            text="还没有相册"
            hint="一个相册就是一组成片，按主题或时间归组"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/admin/albums/new")}
              >
                新建相册
              </Button>
            }
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
          </div>
        )}
      </Sheet>

      {confirmElement}
    </>
  );
}