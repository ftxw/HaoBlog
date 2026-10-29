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
import {
  Button,
  Sheet,
  SheetHeader,
  Loading,
  PageHeader,
  Segmented,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";
import { defaultConfigValue } from "@/app/lib/site-config-defs";
import { resolveCoverChain } from "@/app/lib/content-cover";
import { useMarkdownPreview } from "@/app/lib/hooks/use-markdown-preview";
import { POST_BODY_STYLE } from "@/app/lib/post-body-style";

import "highlight.js/styles/vs2015.css";
import "katex/dist/katex.min.css";

const MD_TOOLS: ReadonlyArray<{
  title: keyof typeof TOOL_ICONS;
  before: string;
  after: string;
  text: string;
  block?: boolean;
}> = [
  { title: "加粗", before: "**", after: "**", text: "粗体" },
  { title: "斜体", before: "*", after: "*", text: "斜体" },
  { title: "二级标题", before: "## ", after: "", text: "标题", block: true },
  { title: "列表", before: "- ", after: "", text: "列表项", block: true },
  { title: "引用", before: "> ", after: "", text: "引用", block: true },
];

const TOOL_ICONS = {
  加粗: Bold,
  斜体: Italic,
  二级标题: Heading2,
  列表: List,
  引用: Quote,
} as const;

export default function AdminAboutPage() {
  const { addToast } = useToast();
  const config = useApi<Record<string, string>>("/api/site-config");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [coverDraft, setCoverDraft] = useState<string | null>(null);
  const [contentDraft, setContentDraft] = useState<string | null>(null);

  const initialized = Boolean(config.data);
  const cover = coverDraft ?? config.data?.aboutCover ?? defaultConfigValue("aboutCover");
  const content =
    contentDraft ?? config.data?.aboutContent ?? defaultConfigValue("aboutContent");

  const postDefaultCover =
    config.data?.defaultPostCover ?? defaultConfigValue("defaultPostCover");
  const effective = resolveCoverChain(cover, content, postDefaultCover);
  const effectiveCoverFrom = {
    explicit: "手动设置",
    content: "正文第一张图",
    fallback: "文章默认封面",
    "": "",
  }[effective.source];

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

  const NL = String.fromCharCode(10);
  const toolbarBtn =
    "rounded-md p-1.5 text-admin-ink-4 hover:bg-admin-neutral hover:text-admin-ink cursor-pointer disabled:opacity-50";

  const toolbarNode = (
    <>
      {MD_TOOLS.map((tool) => {
        const Icon = TOOL_ICONS[tool.title];
        return (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            className={toolbarBtn}
            onClick={() =>
              insertAtCursor(
                (tool.block ? NL : "") + tool.before,
                tool.after,
                tool.text
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
      <button
        type="button"
        title="代码块"
        className={toolbarBtn}
        onClick={() =>
          insertAtCursor(NL + "```" + NL, NL + "```" + NL, "code")
        }
      >
        <Code className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="链接"
        className={toolbarBtn}
        onClick={() => insertAtCursor("[", "](https://)", "链接文字")}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="插入图片"
        className={toolbarBtn}
        disabled={uploadingImage}
        onClick={() => fileRef.current?.click()}
      >
        {uploadingImage ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImageIcon className="h-3.5 w-3.5" />
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
    </>
  );

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
        <Sheet>
          <Loading />
        </Sheet>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <Sheet>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border-soft px-4 py-2">
              <div className="flex items-center gap-0.5">{toolbarNode}</div>
              <Segmented
                items={[
                  { key: "edit", label: "编辑" },
                  { key: "preview", label: "预览" },
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>

            {tab === "edit" ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContentDraft(e.target.value)}
                placeholder="在此输入关于页正文（Markdown）…"
                className="min-h-[460px] w-full resize-y bg-transparent px-5 py-4 font-mono text-[13px] leading-7 text-admin-ink-2 focus:outline-none"
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
              <div className="min-h-[460px] px-5 py-4">
                <style>{POST_BODY_STYLE}</style>
                <div
                  className="post-body"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}
            <div className="flex justify-between border-t border-admin-border-soft px-5 py-2 text-xs text-admin-ink-4">
              <span>Markdown · 支持粘贴或上传插图</span>
              <span className="tabular-nums">{content.length} 字</span>
            </div>
          </Sheet>

          <Sheet>
            <SheetHeader title="关于页封面" />
            <div className="p-4">
              <ImageUploader
                mode="single"
                value={cover}
                onChange={(urls) => setCoverDraft(urls[0] || "")}
                height="h-36"
                category="system"
              />
              <p className="mt-2 text-xs leading-relaxed text-admin-ink-4">
                留空时取正文第一张图，仍没有则用「文章默认封面」；都没有则不显示封面。
              </p>
              <p
                className="mt-1.5 truncate rounded bg-admin-neutral px-2 py-1 text-xs text-admin-ink-4"
                title={effective.url || undefined}
              >
                {effective.url
                  ? `当前生效：${effectiveCoverFrom} · ${effective.url}`
                  : "当前不显示封面"}
              </p>
            </div>
          </Sheet>
        </div>
      )}
    </>
  );
}