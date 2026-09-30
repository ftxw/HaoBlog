"use client";


import { useRef, useState } from "react";
import {
  Bold,
  Code,
  Heading2,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  Loader2,
  Quote,
} from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction, useApi, uploadImage } from "@/components/admin/lib";
import { saveSiteConfigAction } from "@/app/actions/site-config";
import { Button, Card, Loading, PageHeader, cn } from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";
import { aboutContentDefault, defaultConfigValue } from "@/app/lib/site-config-defs";
import { useMarkdownPreview } from "@/app/lib/hooks/use-markdown-preview";
import { POST_BODY_STYLE } from "@/app/lib/post-body-style";

import "highlight.js/styles/vs2015.css";
import "katex/dist/katex.min.css";

export default function AdminAboutPage() {
  const { addToast } = useToast();
  const config = useApi<Record<string, string>>("/api/site-config");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  /* 草稿为 null 表示「用户还没改过」，此时跟随接口值；避免在渲染期 setState 去灌初值。 */
  const [coverDraft, setCoverDraft] = useState<string | null>(null);
  const [contentDraft, setContentDraft] = useState<string | null>(null);

  const initialized = Boolean(config.data);
  const cover =
    coverDraft ?? (config.data?.aboutCover || defaultConfigValue("aboutCover"));
  const content =
    contentDraft ?? (config.data?.aboutContent || aboutContentDefault);

  const previewHtml = useMarkdownPreview(content, tab === "preview");

  const insertAtCursor = (before: string, after = "", defaultText = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end) || defaultText;
    const next =
      content.slice(0, start) + before + selected + after + content.slice(end);
    setContentDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const insertImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const { url } = await uploadImage(file, { category: "system" });
      insertAtCursor(`\n![图片](${url})\n`);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "图片上传失败");
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await runAction(
        saveSiteConfigAction({ aboutContent: content, aboutCover: cover })
      );
      addToast("success", "关于页已保存");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const toolbarBtn =
    "rounded-md p-1.5 text-admin-ink-4 hover:bg-admin-neutral hover:text-admin-ink cursor-pointer disabled:opacity-50";

  return (
    <>
      <PageHeader
        title="关于页"
        description="编辑前台 /about 页面的封面与正文内容（Markdown）"
        actions={
          <Button onClick={handleSave} loading={saving} disabled={!initialized}>
            {saving ? "保存中…" : "保存"}
          </Button>
        }
      />

      {config.loading || !initialized ? (
        <Card>
          <Loading />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card>
              <div className="flex items-center justify-between border-b border-admin-border-soft px-3 py-2">
                <div className="flex items-center gap-0.5">
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
                    onClick={() => insertAtCursor("\n```", "\n```\n", "code")}
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
                    onChange={(e) =>
                      e.target.files?.[0] && insertImage(e.target.files[0])
                    }
                  />
                </div>
                <div className="flex rounded-lg bg-admin-neutral p-0.5 text-xs">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2.5 py-1 cursor-pointer",
                      tab === "edit"
                        ? "bg-admin-surface font-medium text-admin-ink shadow-sm"
                        : "text-admin-ink-4"
                    )}
                    onClick={() => setTab("edit")}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2.5 py-1 cursor-pointer",
                      tab === "preview"
                        ? "bg-admin-surface font-medium text-admin-ink shadow-sm"
                        : "text-admin-ink-4"
                    )}
                    onClick={() => setTab("preview")}
                  >
                    预览
                  </button>
                </div>
              </div>

              {tab === "edit" ? (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContentDraft(e.target.value)}
                  placeholder="在此输入关于页正文（Markdown）…"
                  className="min-h-[460px] w-full resize-y px-4 py-3 font-mono text-sm leading-relaxed text-admin-ink focus:outline-none"
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
                <div className="min-h-[460px] px-4 py-3">
                  <style>{POST_BODY_STYLE}</style>
                  <div
                    className="post-body"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              )}
              <div className="flex justify-between border-t border-admin-border-soft px-4 py-2 text-xs text-admin-ink-5">
                <span>Markdown 编辑 · 支持粘贴/上传插图</span>
                <span>{content.length} 字</span>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="mb-2 text-sm font-medium text-admin-ink-2">关于页封面</p>
              <ImageUploader
                mode="single"
                value={cover}
                onChange={(urls) => setCoverDraft(urls[0] || "")}
                height="h-40"
                category="system"
              />
              <p className="mt-2 text-xs text-admin-ink-5">
                顶部大图，上传后自动保存到图床；留空使用默认封面
              </p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
