"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const FloatingPlayer = dynamic(() => import("@/components/music/FloatingPlayer"), { ssr: false });
const BusinessLinkPanel = dynamic(() => import("@/components/widgets/BusinessLinkPanel"), { ssr: false });

export default function ClientWidgets() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: 挂载门控，让首帧与 SSR 一致（见上）
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      <FloatingPlayer />
      <BusinessLinkPanel />
    </>
  );
}
