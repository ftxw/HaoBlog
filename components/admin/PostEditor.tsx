"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  Italic,
  Heading2,
  Link as LinkIcon,
  Code,
  List,
  Quote,
  ImageIcon,
  ChevronDown,
  Plus,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import {
  apiJson,
  runAction,
  uploadImage,
  formatDate,
} from "@/components/admin/lib";
import { createPostAction, updatePostAction } from "@/app/actions/posts";
import {
  Button,
  Card,
  Field,
  Select,
  Switch,
  Textarea,
  cn,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";
import type { CategoryItem } from "@/app/lib/queries/catalog";
import { useMarkdownPreview } from "@/app/lib/hooks/use-markdown-preview";
import { POST_BODY_STYLE } from "@/app/lib/post-body-style";

import "highlight.js/styles/vs2015.css";
import "katex/dist/katex.min.css";

interface PostDetail {
  id: string;
  title: string;
  description: string;
  cover: string;
  category: string;
  category_id?: string | null;
  tags: string[];
  status: string;
  is_pinned: boolean;
  content: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function PostEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [coverOrientation, setCoverOrientation] = useState("landscape");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tagsText, setTagsText] = useState("");
  const [status, setStatus] = useState("draft");
  const [isPinned, setIsPinned] = useState(false);
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiJson<CategoryItem[]>("/api/categories")
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        if (!cancelled) addToast("error", "获取分类列表失败");
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    apiJson<PostDetail>(`/api/posts/${postId}`)
      .then((post) => {
        if (cancelled) return;
        setTitle(post.title);
        setDescription(post.description || "");
        setCover(post.cover || "");
        setStatus(post.status);
        setIsPinned(Boolean(post.is_pinned));
        setContent(post.content || "");
        setUpdatedAt(post.updated_at);
        setTagsText((post.tags || []).join(", "));
        setCategoryId(post.category_id || "");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        addToast("error", e.message);
        router.replace("/admin/posts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, addToast, router]);

  const parsedTags = useMemo(
    () =>
      tagsText
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsText]
  );

  const previewHtml = useMarkdownPreview(content, tab === "preview");

  const insertAtCursor = (before: string, after = "", defaultText = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end) || defaultText;
    const next =
      content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const insertImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const { url } = await uploadImage(file, {
        category: "posts",
        folder: postId || "",
      });
      insertAtCursor(`\n![图片](${url})\n`);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "图片上传失败");
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** overrideStatus 传入时强制用该状态保存（「发布」按钮用 published） */
  const handleSave = async (overrideStatus?: string) => {
    if (!title.trim()) {
      addToast("warning", "请填写文章标题");
      return;
    }
    const nextStatus = overrideStatus ?? status;
    setSaving(true);
    const body = {
      title: title.trim(),
      description,
      content,
      cover,
      category_id: categoryId || null,
      tags: parsedTags,
      status: nextStatus,
      is_pinned: isPinned,
    };
    try {
      if (postId) {
        await runAction(updatePostAction(postId, body));
        addToast("success", "文章已更新");
      } else {
        await runAction(createPostAction(body));
        addToast(
          "success",
          nextStatus === "published" ? "文章已发布" : "草稿已保存"
        );
      }
      router.push("/admin/posts");
      router.refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-admin-ink-5">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">加载文章中…</span>
      </div>
    );
  }

  const toolbarBtn =
    "rounded-md p-1.5 text-admin-ink-4 hover:bg-admin-neutral hover:text-admin-ink cursor-pointer disabled:opacity-50";

  const tools = (
    <>
      <button
        type="button"
        title="加粗"
        className={toolbarBtn}
        onClick={() => insertAtCursor("**", "**", "粗体")}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="斜体"
        className={toolbarBtn}
        onClick={() => insertAtCursor("*", "*", "斜体")}
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="二级标题"
        className={toolbarBtn}
        onClick={() => insertAtCursor("\n## ", "", "标题")}
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="列表"
        className={toolbarBtn}
        onClick={() => insertAtCursor("\n- ", "", "列表项")}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="引用"
        className={toolbarBtn}
        onClick={() => insertAtCursor("\n> ", "", "引用")}
      >
        <Quote className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="代码块"
        className={toolbarBtn}
        onClick={() => insertAtCursor("\n```\n", "\n```\n", "在这里写代码")}
      >
        <Code className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="链接"
        className={toolbarBtn}
        onClick={() => insertAtCursor("[", "](https://)", "链接文字")}
      >
        <LinkIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="插入图片"
        className={toolbarBtn}
        disabled={uploadingImage}
        onClick={() => fileRef.current?.click()}
      >
        {uploadingImage ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && insertImage(e.target.files[0])}
      />
    </>
  );

  return (
    <div className="space-y-4">
      {/* 1. 标题卡：标题 + 保存 / 发布 */}
      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-admin-ink">
            {postId ? "编辑文章" : "新建博客文章"}
          </h1>
          {postId && (
            <p className="mt-0.5 text-xs text-admin-ink-5">
              {updatedAt ? `最后更新于 ${formatDate(updatedAt)}` : "填写内容后保存"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="soft"
            size="sm"
            onClick={() => handleSave()}
            loading={saving}
          >
            保存
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave("published")}
            loading={saving}
          >
            发布
          </Button>
        </div>
      </Card>

      {/* 2. 工具栏卡 */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-0.5">{tools}</div>
          <div className="flex rounded-lg bg-admin-neutral p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1 cursor-pointer",
                tab === "edit"
                  ? "bg-admin-surface font-medium text-admin-ink"
                  : "text-admin-ink-4"
              )}
              onClick={() => setTab("edit")}
            >
              编辑
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1 cursor-pointer",
                tab === "preview"
                  ? "bg-admin-surface font-medium text-admin-ink"
                  : "text-admin-ink-4"
              )}
              onClick={() => setTab("preview")}
            >
              预览
            </button>
          </div>
        </div>
      </Card>

      {/* 3. 内容卡：标题 + 封面 + 分类/标签 + 正文 */}
      <Card className="px-5 py-6 lg:px-10 lg:py-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入标题"
              className="w-full bg-transparent text-2xl font-bold text-admin-ink placeholder:text-admin-ink-none focus:outline-none"
            />

            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
              <div className="relative inline-flex items-center rounded-lg transition-colors hover:bg-admin-neutral">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={cn(
                    "cursor-pointer appearance-none bg-transparent py-1.5 pl-2.5 pr-7 text-sm focus:outline-none",
                    categoryId ? "text-admin-ink-2" : "text-admin-ink-4"
                  )}
                >
                  <option value="">选择分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-admin-ink-5" />
              </div>

              <span className="h-4 w-px bg-admin-border" />

              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="插入标签"
                className="w-28 bg-transparent py-1.5 text-sm text-admin-ink placeholder:text-admin-ink-4 focus:outline-none"
              />
              {parsedTags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-admin-neutral px-2 py-1 text-xs text-admin-ink-3"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0">
            <ImageUploader
              mode="single"
              value={cover}
              onChange={(urls) => setCover(urls[0] || "")}
              onOrientation={setCoverOrientation}
              boxSize="w-44"
              height="h-36"
              emptyContent={
                <>
                  <Plus className="h-5 w-5" />
                  <span className="text-xs">封面 800×600</span>
                </>
              }
              category="posts"
            />
            {cover && (
              <p className="mt-1.5 text-center text-xs text-admin-ink-5">
                {coverOrientation === "portrait" ? "竖版" : "横版"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          {tab === "edit" ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请输入内容…"
              className="min-h-[420px] w-full resize-y bg-transparent text-sm leading-relaxed text-admin-ink focus:outline-none"
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key.toLowerCase() === "b") {
                  e.preventDefault();
                  insertAtCursor("**", "**", "粗体");
                } else if (e.ctrlKey && e.key.toLowerCase() === "i") {
                  e.preventDefault();
                  insertAtCursor("*", "*", "斜体");
                }
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files).filter((f) =>
                  f.type.startsWith("image/")
                );
                if (files.length > 0) {
                  e.preventDefault();
                  insertImage(files[0]);
                }
              }}
            />
          ) : (
            <div className="min-h-[420px]">
              <style>{POST_BODY_STYLE}</style>
              <div
                className="post-body"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-between text-xs text-admin-ink-5">
          <span>Markdown 编辑 · 支持粘贴/上传插图</span>
          <span>{content.length} 字</span>
        </div>
      </Card>

      {/* 4. 更多设置（低频字段折叠） */}
      <Card>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left"
        >
          <span className="text-sm font-semibold text-admin-ink">
            更多设置
            <span className="ml-2 text-xs font-normal text-admin-ink-5">
              摘要 · 发布状态 · 置顶
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-admin-ink-4 transition-transform",
              moreOpen && "rotate-180"
            )}
          />
        </button>
        {moreOpen && (
          <div className="space-y-4 border-t border-admin-border-soft px-5 py-4">
            <Field label="摘要" hint="列表页与分享卡片展示的简介">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="文章摘要（列表页展示）"
                rows={2}
              />
            </Field>
            <Field label="发布状态" hint="「保存」按此状态保存，「发布」始终正式发布">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="published">正式发布（前台可见）</option>
                <option value="draft">存为草稿（前台不可见）</option>
              </Select>
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-admin-ink-2">
                置顶文章
              </span>
              <Switch checked={isPinned} onChange={setIsPinned} />
            </div>
            <Field label="返回">
              <Button variant="soft" size="sm" onClick={() => router.back()}>
                返回上一页
              </Button>
            </Field>
          </div>
        )}
      </Card>
    </div>
  );
}
