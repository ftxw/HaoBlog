
export const revalidate = 300;

import HomeClient from "./HomeClient";
import { prisma } from "@/app/lib/prisma";
import { formatDateTimeCN } from "@/app/lib/format";
import { POST_FEED_SELECT } from "@/app/lib/queries/posts";

function formatUpdateTime(date: Date | string): string {
  try {
    const full = formatDateTimeCN(new Date(date));
    if (!full) return "";
    const [datePart, timePart] = full.split(" ");
    if (timePart === "00:00") return datePart;
    return full;
  } catch {
    return "";
  }
}

async function fetchHomeData() {
  try {
    const settled = await Promise.allSettled([
      prisma.post.findMany({
        where: { status: "published" },
        select: POST_FEED_SELECT,
        orderBy: { published_at: "desc" },
        take: 20,
      }),
      prisma.chatter.findMany({
        where: { status: "published" },
        orderBy: { created_at: "desc" },
        take: 5,
        select: { id: true, content: true, images: true, created_at: true },
      }),
      prisma.album.findMany({
        orderBy: [{ sort: "asc" }, { created_at: "desc" }],
        take: 1,
        select: {
          cover: true,
          title: true,
          description: true,
          photos: { take: 1, orderBy: { sort: "asc" }, select: { url: true } },
        },
      }),
      // 刻意不复用 queries 层的 getContentCounts()：它为后台仪表盘一次跑 7 项 count。
      prisma.$transaction([
        prisma.post.count({ where: { status: "published" } }),
        prisma.chatter.count({ where: { status: "published" } }),
        prisma.photo.count(),
      ]),
    ]);

    const [postsRes, chattersRes, albumsRes, countsRes] = settled;

    const degraded = (label: string, r: PromiseSettledResult<unknown>) => {
      if (r.status === "rejected") {
        console.error(`[home] ${label} 查询失败，该模块降级为空:`, r.reason);
        return true;
      }
      return false;
    };
    degraded("posts", postsRes);
    degraded("chatters", chattersRes);
    degraded("albums", albumsRes);
    degraded("counts", countsRes);

    const posts = postsRes.status === "fulfilled" ? postsRes.value : [];
    const chatters = chattersRes.status === "fulfilled" ? chattersRes.value : [];
    const albums = albumsRes.status === "fulfilled" ? albumsRes.value : [];
    const counts =
      countsRes.status === "fulfilled" ? countsRes.value : ([0, 0, 0] as number[]);
    const [postCount, chatterCount, photoCount] = counts;

    const searchPosts = posts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      tags: p.tags.map((t) => t.tag.name),
      date: p.published_at ? formatUpdateTime(p.published_at) : "",
    }));

    const latestPosts =
      posts.length > 0
        ? posts.slice(0, 5).map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            cover: p.cover || "",
            formattedDate: p.published_at ? formatUpdateTime(p.published_at) : "",
          }))
        : [
            {
              id: "none",
              title: "暂无文章",
              description: "快去写第一篇吧！",
              cover: "",
              formattedDate: "",
            },
          ];

      const latestChatters =
        chatters.length > 0
          ? chatters.map((c) => {
              const images = c.images;
              const firstLine =
                c.content
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)[0] || "碎片记录";
            return {
              id: c.id,
              title: firstLine.slice(0, 24),
              description: c.content.replace(/\s+/g, " ").slice(0, 100),
              cover: images[0] || "",
              formattedDate: formatUpdateTime(c.created_at),
            };
          })
        : [
            {
              id: "none",
              title: "暂无记录",
              description: "记录一段思绪...",
              cover: "",
              formattedDate: "",
            },
          ];

    const latestAlbum = albums[0];
    const firstPhotoUrl = latestAlbum?.photos?.[0]?.url || "";
    const photoWall = {
      cover: latestAlbum?.cover || firstPhotoUrl || "",
      title: latestAlbum?.title || "照片墙",
      description: latestAlbum?.description || "记录生活的每一个瞬间",
    };

    return { searchPosts, latestPosts, latestChatters, photoWall, postCount, chatterCount, photoCount };
  } catch (e) {
    console.error("[home] fetchHomeData 失败:", e);
    return {
      searchPosts: [],
      latestPosts: [
        {
          id: "none",
          title: "暂无文章",
          description: "快去写第一篇吧！",
          cover: "",
          formattedDate: "",
        },
      ],
      latestChatters: [
        {
          id: "none",
          title: "暂无记录",
          description: "记录一段思绪...",
          cover: "",
          formattedDate: "",
        },
      ],
      photoWall: {
        cover: "",
        title: "照片墙",
        description: "记录生活的每一个瞬间",
      },
      postCount: 0,
      chatterCount: 0,
      photoCount: 0,
    };
  }
}

export default async function Home() {
  const data = await fetchHomeData();
  return <HomeClient {...data} />;
}
