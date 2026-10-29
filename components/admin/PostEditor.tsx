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
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, runAction, uploadImage, formatDate } from "@/components/admin/lib";
import { createPostAction, updatePostAction } from "@/app/actions/posts";
import {
  Button,
  Sheet,
  SheetHeader,
  PageHeader,
  Segmented,
  Input,
  cn,
} from "@/components/admin/ui";
import CategorySelect from "@/components/admin/CategorySelect";
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
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [originStatus, setOriginStatus] = useState<"draft" | "published">("draft");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tagsText, setTagsText] = useState("");
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
        setOriginStatus(post.status === "published" ? "published" : "draft");
        setIsPinned(Boolean(post.is_pinned));
        setCategoryId(post.category_id || "");
        setTagsText((post.tags ?? []).join(", "));
        setContent(post.content || "");
        setUpdatedAt(post.updated_at);
      })
      .catch((e: Error) => {
        if (!cancelled) addToast("error", e.message || "加载文章失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, addToast]);

  const previewHtml = useMarkdownPreview(content, tab === "preview");

  const tags = useMemo(
    () =>
      tagsText
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsText]
  );

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
      const { url } = await uploadImage(file, { category: "posts" });
      insertAtCursor(`\n![图片](${url})\n`);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "图片上传失败");
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!title.trim()) {
      addToast("warning", "请填写标题");
      return;
    }
    setSaving(status);
    try {
      const body = {
        title: title.trim(),
        description,
        content,
        cover,
        category_id: categoryId || null,
        tags,
        status,
        is_pinned: isPinned,
      };
      if (postId) {
        await runAction(updatePostAction(postId, body));
        addToast("success", "已保存");
        router.refresh();
      } else {
        const created = await runAction(createPostAction(body));
        addToast("success", status === "published" ? "已发布" : "草稿已保存");
        if (created?.id) router.replace(`/admin/posts/${created.id}`);
      }
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Sheet>
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-admin-ink-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载文章…
        </div>
      </Sheet>
    );
  }

  const toolbarBtn =
    "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-admin-ink-3 transition-colors hover:bg-admin-neutral hover:text-admin-ink";

  const tools = (
    <>
      <button type="button" title="加粗" className={toolbarBtn} onClick={() => insertAtCursor("**", "**", "加粗")}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="斜体" className={toolbarBtn} onClick={() => insertAtCursor("*", "*", "斜体")}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="二级标题" className={toolbarBtn} onClick={() => insertAtCursor("\n## ", "", "标题")}>
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="链接" className={toolbarBtn} onClick={() => insertAtCursor("[", "](https://)", "链接文字")}>
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="引用" className={toolbarBtn} onClick={() => insertAtCursor("\n> ", "", "引用内容")}>
        <Quote className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="列表" className={toolbarBtn} onClick={() => insertAtCursor("\n- ", "", "列表项")}>
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="插入图片"
        className={toolbarBtn}
        onClick={() => fileRef.current?.click()}
        disabled={uploadingImage}
      >
        {uploadingImage ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImageIcon className="h-3.5 w-3.5" />
        )}
      </button>
      <button type="button" title="代码块" className={toolbarBtn} onClick={() => insertAtCursor("\n```\n", "\n```\n", "在这里写代码")}>
        <Code className="h-3.5 w-3.5" />
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
      <PageHeader
        title={postId ? "编辑文章" : "新建博客文章"}
        description={
          postId && updatedAt
            ? `最后更新于 ${formatDate(updatedAt)}`
            : "标题、封面、分类与正文在同一页完成"
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push("/admin/posts")}>
              <ArrowLeft className="h-3.5 w-3.5" />
              返回
            </Button>
            {postId ? (
              <Button
                variant="secondary"
                title={
                  originStatus === "published"
                    ? "保存（保持已发布状态）"
                    : "保存（保持草稿状态）"
                }
                onClick={() => handleSave(originStatus)}
                loading={saving === originStatus}
                disabled={saving !== null}
              >
                保存
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  title="保存为草稿（未发布）"
                  onClick={() => handleSave("draft")}
                  loading={saving === "draft"}
                  disabled={saving !== null}
                >
                  存草稿
                </Button>
                <Button
                  title="立即发布（已发布）"
                  onClick={() => handleSave("published")}
                  loading={saving === "published"}
                  disabled={saving !== null}
                >
                  发布
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Sheet>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border-soft px-4 py-2">
            <div className="flex flex-wrap items-center gap-0.5">{tools}</div>
            <Segmented
              items={[
                { key: "edit", label: "编辑" },
                { key: "preview", label: "预览" },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          <div className="space-y-4 p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入标题"
              className="w-full bg-transparent text-xl font-semibold text-admin-ink placeholder:text-admin-ink-5 focus:outline-none"
            />

            <div className="flex flex-wrap items-center gap-3 border-b border-admin-border-soft pb-3">
              <CategorySelect
                value={categoryId}
                categories={categories}
                onChange={setCategoryId}
                onCreated={(item) => setCategories((prev) => [...prev, item])}
              />
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="标签，逗号分隔"
                className="!h-7 max-w-[16rem]"
              />
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="用 Markdown 写作，支持粘贴或上传插图"
              className={cn(
                "min-h-[460px] w-full resize-y bg-transparent text-[14px] leading-7 text-admin-ink-2 outline-none placeholder:text-admin-ink-5",
                tab === "preview" && "hidden"
              )}
            />

            {tab === "preview" && (
              <div className="min-h-[460px]">
                <style>{POST_BODY_STYLE}</style>
                <div
                  className="post-body"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}

            <div className="flex justify-between border-t border-admin-border-soft pt-2.5 text-xs text-admin-ink-4">
              <span>Markdown · 支持粘贴或上传插图</span>
              <span className="tabular-nums">{content.length} 字</span>
            </div>
          </div>
        </Sheet>

        <div className="space-y-4">
          <Sheet>
            <SheetHeader title="发布" />
            <div className="space-y-3 p-4">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="摘要（用于列表与分享卡片）"
              />
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-admin-ink-2">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="h-4 w-4 rounded border-admin-border-control accent-admin-accent"
                />
                置顶这篇文章
              </label>
            </div>
          </Sheet>

          <Sheet>
            <SheetHeader title="封面" />
            <div className="p-4">
              <ImageUploader
                mode="single"
                value={cover}
                onChange={(urls) => setCover(urls[0] || "")}
                height="h-32"
                category="posts"
                folder={postId}
              />
              <p className="mt-2 text-xs leading-relaxed text-admin-ink-4">
                留空时自动使用正文第一张图，否则回落到站点默认封面
              </p>
            </div>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
