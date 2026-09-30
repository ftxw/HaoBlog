"use client";

import { useState } from "react";
import { GripVertical, Plus, ExternalLink } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction, useApi, formatDate } from "@/components/admin/lib";
import {
  createBookmarkCategoryAction,
  createBookmarkSiteAction,
  deleteBookmarkCategoryAction,
  deleteBookmarkSiteAction,
  reorderBookmarkCategoriesAction,
  reorderBookmarkSitesAction,
  updateBookmarkCategoryAction,
  updateBookmarkSiteAction,
} from "@/app/actions/bookmarks";
import {
  AdminTabBar,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Textarea,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import { TABLE_HEAD_CELL, TABLE_SHELL } from "@/components/admin/styles";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";
import type {
  BookmarkCategoryItem,
  BookmarkSiteItem,
} from "@/app/lib/queries/bookmarks";

function SortableCategoryRow({
  cat,
  onEdit,
  onDelete,
}: {
  cat: BookmarkCategoryItem;
  onEdit: (cat: BookmarkCategoryItem) => void;
  onDelete: (cat: BookmarkCategoryItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "grid grid-cols-[8%_20%_34%_8%_15%_15%] cursor-grab border-b border-admin-border-soft text-admin-ink-2 last:border-0 hover:bg-admin-row-hover active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg ring-2 ring-inset ring-admin-accent-ring"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate">{cat.icon || "-"}</span>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate font-medium text-admin-ink">
          {cat.name}
        </span>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate text-admin-ink-4">
          {cat.description || "-"}
        </span>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-admin-ink-none">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-xs text-admin-ink-4">
        {formatDate(cat.created_at)}
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
        <Button size="sm" variant="ghost" onClick={() => onEdit(cat)}>
          编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger-hover"
          onClick={() => onDelete(cat)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

function SortableSiteRow({
  site,
  categoryName,
  onEdit,
  onDelete,
}: {
  site: BookmarkSiteItem;
  categoryName: string;
  onEdit: (site: BookmarkSiteItem) => void;
  onDelete: (site: BookmarkSiteItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: site.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "grid grid-cols-[20%_24%_12%_16%_8%_20%] cursor-grab border-b border-admin-border-soft text-admin-ink-2 last:border-0 hover:bg-admin-row-hover active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg ring-2 ring-inset ring-admin-accent-ring"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex h-[60px] overflow-hidden items-center justify-center gap-2 px-4">
        {site.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={site.icon} alt="" className="h-5 w-5 shrink-0 rounded" />
        )}
        <span className="truncate font-medium text-admin-ink">
          {site.name}
        </span>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 truncate text-admin-accent hover:underline"
        >
          <span className="truncate">{site.url}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate">{categoryName}</span>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate text-xs text-admin-ink-4">
          {site.platforms?.length ? site.platforms.join(" / ") : "-"}
        </span>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-admin-ink-none">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
        <Button size="sm" variant="ghost" onClick={() => onEdit(site)}>
          编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger-hover"
          onClick={() => onDelete(site)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

export default function BookmarksClient({
  initialCategories,
  initialSites,
}: {
  initialCategories: BookmarkCategoryItem[];
  initialSites: BookmarkSiteItem[];
}) {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const categories = useApi<BookmarkCategoryItem[]>(
    "/api/bookmarks/categories",
    initialCategories
  );
  const sites = useApi<BookmarkSiteItem[]>("/api/bookmarks/sites", initialSites);

  const [tab, setTab] = useState<"sites" | "categories">("sites");

  const PAGE_SIZE = 10;
  const [catPage, setCatPage] = useState(1);
  const [sitePage, setSitePage] = useState(1);
  const catList = (categories.data ?? []).slice(
    (catPage - 1) * PAGE_SIZE,
    catPage * PAGE_SIZE
  );
  const siteList = (sites.data ?? []).slice(
    (sitePage - 1) * PAGE_SIZE,
    sitePage * PAGE_SIZE
  );

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<BookmarkCategoryItem | null>(null);
  const [catForm, setCatForm] = useState({
    name: "",
    icon: "",
    description: "",
  });
  const [catSaving, setCatSaving] = useState(false);

  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ name: "", icon: "", description: "" });
    setCatModalOpen(true);
  };

  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<BookmarkSiteItem | null>(null);
  const [siteForm, setSiteForm] = useState({
    category_id: "",
    name: "",
    url: "",
    icon: "",
    description: "",
    platforms: "",
  });
  const [siteSaving, setSiteSaving] = useState(false);

  const openNewSite = () => {
    setEditingSite(null);
    setSiteForm({
      category_id: "",
      name: "",
      url: "",
      icon: "",
      description: "",
      platforms: "",
    });
    setSiteModalOpen(true);
  };

  const catName = (id: string) =>
    (categories.data ?? []).find((c) => c.id === id)?.name ?? `#${id}`;

  const commitCatReorder = async (ids: string[]) => {
    try {
      await runAction(reorderBookmarkCategoriesAction({ ids }));
      addToast("success", "排序已更新");
      categories.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      categories.reload();
    }
  };

  const commitSiteReorder = async (ids: string[]) => {
    try {
      await runAction(reorderBookmarkSitesAction({ ids }));
      addToast("success", "排序已更新");
      sites.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      sites.reload();
    }
  };

  const catDrag = useDragSort<BookmarkCategoryItem>({
    items: catList,
    onReorder: (nextIds) =>
      categories.setData((prev) => (prev ? reorderItemsByIds(prev, nextIds) : prev)),
    onCommit: commitCatReorder,
  });
  const siteDrag = useDragSort<BookmarkSiteItem>({
    items: siteList,
    onReorder: (nextIds) =>
      sites.setData((prev) => (prev ? reorderItemsByIds(prev, nextIds) : prev)),
    onCommit: commitSiteReorder,
  });

  const saveCategory = async () => {
    if (!catForm.name.trim()) {
      addToast("warning", "请填写分类名称");
      return;
    }
    setCatSaving(true);
    try {
      const body = {
        name: catForm.name.trim(),
        icon: catForm.icon,
        description: catForm.description,
      };
      if (editingCat) {
        await runAction(updateBookmarkCategoryAction(editingCat.id, body));
        addToast("success", "分类已更新");
      } else {
        await runAction(createBookmarkCategoryAction(body));
        addToast("success", "分类已创建");
      }
      setCatModalOpen(false);
      categories.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (cat: BookmarkCategoryItem) => {
    const ok = await confirm(
      "删除分类",
      `确定删除书签分类「${cat.name}」？该分类下的站点会一并失效。`
    );
    if (!ok) return;
    try {
      await runAction(deleteBookmarkCategoryAction(cat.id));
      addToast("success", "分类已删除");
      categories.reload();
      sites.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  const saveSite = async () => {
    if (!siteForm.name.trim() || !siteForm.url.trim() || !siteForm.category_id) {
      addToast("warning", "请填写分类、名称和 URL");
      return;
    }
    setSiteSaving(true);
    try {
      const platforms = siteForm.platforms
        .split(/[,，]/)
        .map((p) => p.trim())
        .filter(Boolean);
      const body = {
        category_id: siteForm.category_id,
        name: siteForm.name.trim(),
        url: siteForm.url.trim(),
        icon: siteForm.icon,
        description: siteForm.description,
        platforms,
      };
      if (editingSite) {
        await runAction(updateBookmarkSiteAction(editingSite.id, body));
        addToast("success", "站点已更新");
      } else {
        await runAction(createBookmarkSiteAction(body));
        addToast("success", "站点已创建");
      }
      setSiteModalOpen(false);
      sites.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSiteSaving(false);
    }
  };

  const deleteSite = async (site: BookmarkSiteItem) => {
    const ok = await confirm("删除站点", `确定删除站点「${site.name}」？`);
    if (!ok) return;
    try {
      await runAction(deleteBookmarkSiteAction(site.id));
      addToast("success", "站点已删除");
      sites.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      <PageHeader title="书签管理" description="管理导航书签的分类与站点" />

      <AdminTabBar
        tabs={[
          { key: "sites", label: `站点（${sites.data?.length ?? 0}）` },
          { key: "categories", label: `分类（${categories.data?.length ?? 0}）` },
        ]}
        active={tab}
        onChange={setTab}
        action={
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => (tab === "sites" ? openNewSite() : openNewCat())}
          >
            <Plus className="h-3.5 w-3.5" />
            {tab === "sites" ? "新建站点" : "新建分类"}
          </Button>
        }
      />

      {tab === "categories" ? (
        <Card>
          {categories.loading && !categories.data ? (
            <Loading />
          ) : (categories.data ?? []).length === 0 ? (
            <EmptyState text="暂无书签分类" />
          ) : (
            <div className={TABLE_SHELL}>
              <div className="grid grid-cols-[8%_20%_34%_8%_15%_15%] border-b border-admin-border bg-admin-surface-muted text-sm font-medium text-admin-ink-4">
                {["图标", "名称", "描述", "拖拽排序", "创建时间", "操作"].map(
                  (h) => (
                    <div
                      key={h}
                      className={TABLE_HEAD_CELL}
                    >
                      {h}
                    </div>
                  )
                )}
              </div>
              <DndContext
                sensors={catDrag.sensors}
                collisionDetection={closestCenter}
                onDragStart={catDrag.handleDragStart}
                onDragOver={catDrag.handleDragOver}
                onDragEnd={catDrag.handleDragEnd}
                onDragCancel={catDrag.handleDragCancel}
              >
                <SortableContext items={catDrag.ids} strategy={catDrag.strategy}>
                  {catList.map((cat) => (
                    <SortableCategoryRow
                      key={cat.id}
                      cat={cat}
                      onEdit={(c) => {
                        setEditingCat(c);
                        setCatForm({
                          name: c.name,
                          icon: c.icon || "",
                          description: c.description || "",
                        });
                        setCatModalOpen(true);
                      }}
                      onDelete={deleteCategory}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div className="px-4 pb-3">
            <Pagination
              page={catPage}
              pageSize={PAGE_SIZE}
              total={categories.data?.length ?? 0}
              onChange={setCatPage}
            />
          </div>
        </Card>
      ) : (
        <Card>
          {sites.loading && !sites.data ? (
            <Loading />
          ) : (sites.data ?? []).length === 0 ? (
            <EmptyState text="暂无书签站点" />
          ) : (
            <div className={TABLE_SHELL}>
              <div className="grid grid-cols-[20%_24%_12%_16%_8%_20%] border-b border-admin-border bg-admin-surface-muted text-sm font-medium text-admin-ink-4">
                {["名称", "URL", "分类", "平台", "拖拽排序", "操作"].map((h) => (
                  <div
                    key={h}
                    className={TABLE_HEAD_CELL}
                  >
                    {h}
                  </div>
                ))}
              </div>
              <DndContext
                sensors={siteDrag.sensors}
                collisionDetection={closestCenter}
                onDragStart={siteDrag.handleDragStart}
                onDragOver={siteDrag.handleDragOver}
                onDragEnd={siteDrag.handleDragEnd}
                onDragCancel={siteDrag.handleDragCancel}
              >
                <SortableContext items={siteDrag.ids} strategy={siteDrag.strategy}>
                  {siteList.map((site) => (
                    <SortableSiteRow
                      key={site.id}
                      site={site}
                      categoryName={catName(site.category_id)}
                      onEdit={(s) => {
                        setEditingSite(s);
                        setSiteForm({
                          category_id: String(s.category_id),
                          name: s.name,
                          url: s.url,
                          icon: s.icon || "",
                          description: s.description || "",
                          platforms: (s.platforms ?? []).join(", "),
                        });
                        setSiteModalOpen(true);
                      }}
                      onDelete={deleteSite}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div className="px-4 pb-3">
            <Pagination
              page={sitePage}
              pageSize={PAGE_SIZE}
              total={sites.data?.length ?? 0}
              onChange={setSitePage}
            />
          </div>
        </Card>
      )}

      <Modal
        open={catModalOpen}
        title={editingCat ? "编辑书签分类" : "新建书签分类"}
        onClose={() => setCatModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModalOpen(false)}>
              取消
            </Button>
            <Button onClick={saveCategory} loading={catSaving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="名称" required>
            <Input
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              placeholder="分类名称"
            />
          </Field>
          <Field label="图标" hint="Emoji 或图标地址">
            <Input
              value={catForm.icon}
              onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
              placeholder="如 🛠️"
            />
          </Field>
          <Field label="描述">
            <Textarea
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={siteModalOpen}
        title={editingSite ? "编辑书签站点" : "新建书签站点"}
        onClose={() => setSiteModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setSiteModalOpen(false)}>
              取消
            </Button>
            <Button onClick={saveSite} loading={siteSaving}>
              保存
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="分类" required>
            <select
              value={siteForm.category_id}
              onChange={(e) => setSiteForm({ ...siteForm, category_id: e.target.value })}
              className="w-full rounded-lg border border-admin-border-control bg-admin-surface px-3 py-2 text-sm focus:border-admin-accent-border focus:outline-none"
            >
              <option value="">请选择分类</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="名称" required>
            <Input
              value={siteForm.name}
              onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
              placeholder="站点名称"
            />
          </Field>
          <Field label="URL" required className="sm:col-span-2">
            <Input
              value={siteForm.url}
              onChange={(e) => setSiteForm({ ...siteForm, url: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="图标地址" hint="站点 favicon 或图片地址">
            <Input
              value={siteForm.icon}
              onChange={(e) => setSiteForm({ ...siteForm, icon: e.target.value })}
              placeholder="https://…/favicon.ico"
            />
          </Field>
          <Field label="描述" className="sm:col-span-2">
            <Textarea
              value={siteForm.description}
              onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
              rows={2}
            />
          </Field>
          <Field label="支持平台" hint="逗号分隔，如：Web, iOS, Android" className="sm:col-span-2">
            <Input
              value={siteForm.platforms}
              onChange={(e) => setSiteForm({ ...siteForm, platforms: e.target.value })}
              placeholder="Web, iOS, Android"
            />
          </Field>
        </div>
      </Modal>

      {confirmElement}
    </>
  );
}
