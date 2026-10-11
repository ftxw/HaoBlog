"use client";

import { useMemo, useState } from "react";
import {
  CirclePlus,
  ExternalLink,
  GripVertical,
  Pencil,
  Settings2,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction, useApi } from "@/components/admin/lib";
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
  Button,
  Card,
  CapsuleFilter,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  NumberPagination,
  Textarea,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import { TABLE_HEAD_CELL, TABLE_SHELL } from "@/components/admin/styles";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CardAction,
  CapsuleDivider,
  ContentCard,
  ListToolbar,
  PageTitleTabs,
  SearchPill,
  ToolbarAction,
} from "@/components/admin/ContentListShell";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";
import BusinessLinksManager from "@/components/admin/BusinessLinksManager";
import type {
  BookmarkCategoryItem,
  BookmarkSiteItem,
} from "@/app/lib/queries/bookmarks";

const PAGE_SIZE = 10;

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
        "grid grid-cols-[8%_22%_38%_8%_24%] cursor-grab border-b border-admin-border-soft text-admin-ink-2 last:border-0 hover:bg-admin-row-hover active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg ring-2 ring-inset ring-admin-accent-ring"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex h-[52px] overflow-hidden items-center justify-center px-4">
        <span className="truncate">{cat.icon || "-"}</span>
      </div>
      <div className="flex h-[52px] overflow-hidden items-center justify-center px-4">
        <span className="truncate font-medium text-admin-ink">{cat.name}</span>
      </div>
      <div className="flex h-[52px] overflow-hidden items-center justify-center px-4">
        <span className="truncate text-admin-ink-4">{cat.description || "-"}</span>
      </div>
      <div className="flex h-[52px] overflow-hidden items-center justify-center px-4 text-admin-ink-none">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex h-[52px] overflow-hidden items-center justify-center gap-1 px-4">
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

function SortableSiteCard({
  site,
  categoryName,
  onEdit,
  onDelete,
}: {
  site: BookmarkSiteItem;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: site.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-60")}
    >
      <ContentCard
        leading={
          <button
            type="button"
            title="拖拽排序"
            aria-label="拖拽排序"
            {...attributes}
            {...listeners}
            className="cursor-grab rounded-lg p-1.5 text-admin-ink-none transition-colors hover:bg-admin-neutral hover:text-admin-ink active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
        title={
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {site.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.icon}
                alt=""
                className="h-4 w-4 shrink-0 rounded"
                loading="lazy"
              />
            )}
            <span className="truncate text-sm font-medium text-admin-ink">
              {site.name}
            </span>
          </span>
        }
        subtitle={site.description || undefined}
        meta={
          <>
            <span>{categoryName}</span>
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex max-w-[14rem] items-center gap-1 text-admin-accent hover:underline"
            >
              <span className="truncate">{site.url}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
            {site.platforms?.length ? (
              <span className="truncate">{site.platforms.join(" / ")}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <CardAction title="编辑" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </CardAction>
            <CardAction title="删除" danger onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </CardAction>
          </>
        }
      />
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

  const [tab, setTab] = useState<"sites" | "links">("sites");

  // 站点筛选与搜索（客户端过滤）
  const [catFilter, setCatFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sitePage, setSitePage] = useState(1);

  const allSites = useMemo(() => sites.data ?? [], [sites.data]);
  const filteredSites = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    return allSites.filter((s) => {
      if (catFilter !== "all" && s.category_id !== catFilter) return false;
      if (!kw) return true;
      return [s.name, s.url, s.description ?? ""].some((f) =>
        f.toLowerCase().includes(kw)
      );
    });
  }, [allSites, catFilter, searchText]);
  const siteList = filteredSites.slice(
    (sitePage - 1) * PAGE_SIZE,
    sitePage * PAGE_SIZE
  );

  const catItems = [
    { key: "all", label: "全部", count: allSites.length },
    ...(categories.data ?? []).map((c) => ({
      key: c.id,
      label: c.name,
      count: allSites.filter((s) => s.category_id === c.id).length,
    })),
  ];

  // ---------- 分组（分类）管理 ----------
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditOpen, setCatEditOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<BookmarkCategoryItem | null>(null);
  const [catForm, setCatForm] = useState({ name: "", icon: "", description: "" });
  const [catSaving, setCatSaving] = useState(false);

  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ name: "", icon: "", description: "" });
    setCatEditOpen(true);
  };

  // ---------- 站点编辑 ----------
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
    items: categories.data ?? [],
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
      setCatEditOpen(false);
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
      {/* 标题行：大字 Tab（书签 | 友情链接） */}
      <div className="mb-4">
        <PageTitleTabs
          tabs={[
            { key: "sites", label: "书签" },
            { key: "links", label: "友情链接" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "sites" ? (
        <>
          <ListToolbar
            actions={
              <>
                <ToolbarAction
                  icon={<CirclePlus className="h-4 w-4" />}
                  label="新建站点"
                  onClick={openNewSite}
                />
                <ToolbarAction
                  icon={<Settings2 className="h-4 w-4" />}
                  label="管理分组"
                  onClick={() => setCatModalOpen(true)}
                />
              </>
            }
          >
            <CapsuleFilter
              items={catItems}
              active={catFilter}
              onChange={(key) => {
                setCatFilter(key);
                setSitePage(1);
              }}
            />
            <CapsuleDivider />
          </ListToolbar>

          <div className="mb-3">
            <SearchPill
              value={searchInput}
              onChange={setSearchInput}
              onSearch={() => {
                setSearchText(searchInput);
                setSitePage(1);
              }}
              placeholder="搜索名称 / URL"
            />
          </div>

          {sites.loading && !sites.data ? (
            <Card>
              <Loading />
            </Card>
          ) : filteredSites.length === 0 ? (
            <Card>
              <EmptyState text="暂无书签站点，点击右上角「新建站点」开始" />
            </Card>
          ) : (
            <>
              <DndContext
                sensors={siteDrag.sensors}
                collisionDetection={closestCenter}
                onDragStart={siteDrag.handleDragStart}
                onDragOver={siteDrag.handleDragOver}
                onDragEnd={siteDrag.handleDragEnd}
                onDragCancel={siteDrag.handleDragCancel}
              >
                <SortableContext items={siteDrag.ids} strategy={siteDrag.strategy}>
                  <div className="space-y-2">
                    {siteList.map((site) => (
                      <SortableSiteCard
                        key={site.id}
                        site={site}
                        categoryName={catName(site.category_id)}
                        onEdit={() => {
                          setEditingSite(site);
                          setSiteForm({
                            category_id: String(site.category_id),
                            name: site.name,
                            url: site.url,
                            icon: site.icon || "",
                            description: site.description || "",
                            platforms: (site.platforms ?? []).join(", "),
                          });
                          setSiteModalOpen(true);
                        }}
                        onDelete={() => deleteSite(site)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <NumberPagination
                page={sitePage}
                pageSize={PAGE_SIZE}
                total={filteredSites.length}
                onChange={setSitePage}
              />
            </>
          )}
        </>
      ) : (
        <BusinessLinksManager />
      )}

      {/* 管理分组（书签分类）弹窗 */}
      <Modal
        open={catModalOpen}
        title="管理分组"
        onClose={() => setCatModalOpen(false)}
        wide
        footer={
          <Button size="sm" onClick={openNewCat}>
            新建分类
          </Button>
        }
      >
        {(categories.data ?? []).length === 0 ? (
          <EmptyState text="暂无分组，点击下方「新建分类」创建" />
        ) : (
          <div className={TABLE_SHELL}>
            <div className="grid grid-cols-[8%_22%_38%_8%_24%] border-b border-admin-border bg-admin-surface-muted text-sm font-medium text-admin-ink-4">
              {["图标", "名称", "描述", "排序", "操作"].map((h) => (
                <div key={h} className={TABLE_HEAD_CELL}>
                  {h}
                </div>
              ))}
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
                {(categories.data ?? []).map((cat) => (
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
                      setCatEditOpen(true);
                    }}
                    onDelete={deleteCategory}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </Modal>

      {/* 分组编辑弹窗（从管理分组弹窗二级打开） */}
      <Modal
        open={catEditOpen}
        title={editingCat ? "编辑分组" : "新建分组"}
        onClose={() => setCatEditOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatEditOpen(false)}>
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

      {/* 站点编辑弹窗 */}
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
          <Field label="分组" required>
            <select
              value={siteForm.category_id}
              onChange={(e) => setSiteForm({ ...siteForm, category_id: e.target.value })}
              className="w-full rounded-lg border border-admin-border-control bg-admin-surface px-3 py-2 text-sm focus:border-admin-accent-border focus:outline-none"
            >
              <option value="">请选择分组</option>
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
