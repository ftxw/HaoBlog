"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDate, runAction, useApi } from "@/components/admin/lib";
import {
  createProjectAction,
  updateProjectAction,
} from "@/app/actions/projects";
import {
  Button,
  Sheet,
  SheetHeader,
  Section,
  PageHeader,
  Field,
  Input,
  Textarea,
  Select,
  Loading,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";
import type { ProjectItem } from "@/app/lib/queries/projects";
import type { ProjectStatus } from "@/app/lib/mutations/projects";
import { CONTENT_STATUSES } from "@/app/lib/content-status";

export type { ProjectItem };

interface FormState {
  name: string;
  description: string;
  long_description: string;
  cover_image: string;
  images: string[];
  techStackText: string;
  status: ProjectStatus;
  status_label: string;
  is_featured: boolean;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  long_description: "",
  cover_image: "",
  images: [],
  techStackText: "",
  status: "draft",
  status_label: "",
  is_featured: false,
};

const PLACEHOLDER_NAME = "未命名项目";

export default function ProjectEditor({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const isNew = !projectId;

  const [currentId, setCurrentId] = useState<string | undefined>(projectId);
  const effectiveId = currentId;
  const listUrl = effectiveId ? `/api/projects/${effectiveId}` : null;
  const { data, loading: dataLoading } = useApi<ProjectItem>(listUrl);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [appliedData, setAppliedData] = useState<ProjectItem | null>(null);
  if (data && data !== appliedData) {
    setAppliedData(data);
    setForm({
      name: data.name || "",
      description: data.description || "",
      long_description: data.long_description || "",
      cover_image: data.cover_image || "",
      images: data.images || [],
      techStackText: (data.tech_stack || []).join(", "),
      status: (CONTENT_STATUSES as readonly string[]).includes(data.status)
        ? (data.status as ProjectStatus)
        : "published",
      status_label: data.status_label || "",
      is_featured: Boolean(data.is_featured),
    });
  }

  const ensureProject = async (): Promise<string | undefined> => {
    if (currentId) return currentId;
    const created = await runAction(
      createProjectAction({
        name: form.name.trim() || PLACEHOLDER_NAME,
        status: "draft",
      })
    );
    setCurrentId(created.id);
    return created.id;
  };

  const handleSave = async (overrideStatus?: ProjectStatus) => {
    if (!form.name.trim()) {
      addToast("warning", "请填写项目名称");
      return;
    }
    setSaving(true);
    try {
      const techStack = form.techStackText
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        name: form.name.trim(),
        description: form.description,
        long_description: form.long_description,
        cover_image: form.cover_image,
        images: form.images,
        tech_stack: techStack,
        status: overrideStatus || form.status,
        status_label: form.status_label,
        is_featured: form.is_featured,
      };
      if (!currentId) {
        const created = await runAction(createProjectAction(body));
        setCurrentId(created.id);
        router.replace(`/admin/projects/${created.id}`);
        addToast("success", "项目已创建");
      } else {
        await runAction(updateProjectAction(currentId, body));
        addToast("success", "项目已保存");
      }
      router.refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.push("/admin/projects");
  };

  if (!isNew && dataLoading) {
    return (
      <Sheet>
        <Loading />
      </Sheet>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? "新建项目" : "编辑项目"}
        description={
          data?.updated_at ? `最后更新于 ${formatDate(data.updated_at)}` : "填写内容后保存"
        }
        actions={
          <>
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              返回
            </Button>
            <Button variant="secondary" onClick={() => handleSave()} loading={saving}>
              保存
            </Button>
            <Button onClick={() => handleSave("published")} loading={saving}>
              发布
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-4">
          <Sheet>
            <SheetHeader title="项目信息" />
            <Section>
              <div className="space-y-4">
                <Field label="项目名称" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="项目名称"
                  />
                </Field>
                <Field label="简介">
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="一句话介绍"
                  />
                </Field>
                <Field label="详细介绍">
                  <Textarea
                    value={form.long_description}
                    onChange={(e) =>
                      setForm({ ...form, long_description: e.target.value })
                    }
                    rows={5}
                    placeholder="详细介绍（支持 Markdown）"
                  />
                </Field>
                <Field label="技术栈" hint="逗号分隔">
                  <Input
                    value={form.techStackText}
                    onChange={(e) =>
                      setForm({ ...form, techStackText: e.target.value })
                    }
                    placeholder="Next.js, Prisma, Tailwind"
                  />
                </Field>
              </div>
            </Section>
          </Sheet>

          <Sheet>
            <SheetHeader title="项目截图" description="支持批量上传，上传顺序即展示顺序" />
            <Section>
              <ImageUploader
                mode="multi"
                value={form.images}
                onChange={(images) => setForm({ ...form, images })}
                category="projects"
                folder={effectiveId ? String(effectiveId) : undefined}
                folderResolver={ensureProject}
              />
            </Section>
          </Sheet>
        </div>

        <div className="space-y-4">
          <Sheet>
            <SheetHeader title="封面图" />
            <Section>
              <ImageUploader
                mode="single"
                value={form.cover_image}
                onChange={(urls) => setForm({ ...form, cover_image: urls[0] || "" })}
                height="h-32"
                category="projects"
                folder={effectiveId ? String(effectiveId) : undefined}
                folderResolver={ensureProject}
              />
            </Section>
          </Sheet>
          <Sheet>
            <SheetHeader title="发布设置" />
            <Section>
              <div className="space-y-4">
                <Field label="状态" hint="仅「已发布」会在前台展示">
                  <Select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as ProjectStatus })
                    }
                  >
                    <option value="published">已发布</option>
                    <option value="draft">隐藏</option>
                  </Select>
                </Field>
                <Field label="状态标签" hint="如：开发中 / 稳定运行">
                  <Input
                    value={form.status_label}
                    onChange={(e) =>
                      setForm({ ...form, status_label: e.target.value })
                    }
                    placeholder="稳定运行"
                  />
                </Field>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-admin-ink-2">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) =>
                      setForm({ ...form, is_featured: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-admin-border-control accent-admin-accent"
                  />
                  精选项目
                </label>
              </div>
            </Section>
          </Sheet>
        </div>
      </div>
    </div>
  );
}