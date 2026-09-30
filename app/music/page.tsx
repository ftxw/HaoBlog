import type { Metadata } from "next";
import MusicClient from "./MusicClient";

export const metadata: Metadata = {
  title: "云端乐律",
  description: "在代码的缝隙中寻找灵魂的共鸣",
};

export default function MusicPage() {
  return <MusicClient />;
}
