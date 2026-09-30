"use client";

import { useEffect } from "react";

export default function ViewCounter({ postId }: { postId: string }) {
  useEffect(() => {
    fetch(`/api/posts/${encodeURIComponent(postId)}/views`, {
      method: "POST",
    }).catch(() => {
    });
  }, [postId]);
  return null;
}
