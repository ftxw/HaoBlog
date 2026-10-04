export const revalidate = 300;

import type { Metadata } from "next";
import {
  listChatters,
  countChatters,
  listChatterFacets,
} from "@/app/lib/queries/chatters";
import { toMomentItem, type MomentItem } from "@/app/lib/moment-item";
import MomentListClient from "./MomentListClient";

export const metadata: Metadata = {
  title: "生活动态",
  description: "在代码之外捕捉瞬间的温度",
};

const PAGE_SIZE = 60;

async function fetchInitialMoments(): Promise<{
  moments: MomentItem[];
  total: number;
  yearOptions: string[];
  moods: string[];
}> {
  try {
    const [rows, total, facets] = await Promise.all([
      listChatters({ status: "published", page: 1, size: PAGE_SIZE }),
      countChatters({ status: "published" }),
      listChatterFacets().catch(() => ({ years: [], moods: [] })),
    ]);
    return {
      moments: rows.map(toMomentItem),
      total,
      yearOptions: facets.years,
      moods: facets.moods,
    };
  } catch (e) {
    console.error("[moments] 加载说说失败:", e);
    return { moments: [], total: 0, yearOptions: [], moods: [] };
  }
}

export default async function MomentsPage() {
  const { moments, total, yearOptions, moods } = await fetchInitialMoments();
  return (
    <MomentListClient
      initialMoments={moments}
      total={total}
      pageSize={PAGE_SIZE}
      yearOptions={yearOptions}
      moodOptions={moods}
    />
  );
}
