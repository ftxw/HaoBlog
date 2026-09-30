
import type { Prisma } from "@prisma/client";

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, "")
    .substring(0, 50);
}

function normalizeTagNames(names: string[]): { name: string; slug: string }[] {
  const seen = new Set<string>();
  const out: { name: string; slug: string }[] = [];
  for (const raw of names) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    const slug = generateSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ name, slug });
  }
  return out;
}

export async function syncPostTags(
  tx: Prisma.TransactionClient,
  postId: string,
  oldTagIds: string[],
  tagNames: string[]
): Promise<void> {
  const oldSet = new Set(oldTagIds.filter(Boolean));
  const wanted = normalizeTagNames(tagNames);

  if (wanted.length === 0) {
    if (oldSet.size > 0) {
      await tx.postTag.deleteMany({
        where: { post_id: postId, tag_id: { in: [...oldSet] } },
      });
    }
    return;
  }

  const slugs = wanted.map((w) => w.slug);
  const names = wanted.map((w) => w.name);

  const findRows = () =>
    tx.tag.findMany({
      where: { OR: [{ slug: { in: slugs } }, { name: { in: names } }] },
      select: { id: true, name: true, slug: true },
    });

  const buildResolver = (rows: { id: string; name: string; slug: string }[]) => {
    const byName = new Map(rows.map((r) => [r.name, r.id]));
    const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
    return (w: { name: string; slug: string }) =>
      byName.get(w.name) ?? bySlug.get(w.slug);
  };

  let resolveId = buildResolver(await findRows());

  const missing = wanted.filter((w) => !resolveId(w));
  if (missing.length > 0) {
    await tx.tag.createMany({
      data: missing.map((m) => ({ name: m.name, slug: m.slug })),
      skipDuplicates: true,
    });
    resolveId = buildResolver(await findRows());
  }

  const newIds = wanted
    .map((w) => resolveId(w))
    .filter((x): x is string => Boolean(x));
  const newSet = new Set(newIds);

  const added = newIds.filter((id) => !oldSet.has(id));
  const removed = [...oldSet].filter((id) => !newSet.has(id));

  if (added.length > 0) {
    await tx.postTag.createMany({
      data: added.map((tag_id) => ({ post_id: postId, tag_id })),
      skipDuplicates: true,
    });
  }
  if (removed.length > 0) {
    await tx.postTag.deleteMany({
      where: { post_id: postId, tag_id: { in: removed } },
    });
  }
}

