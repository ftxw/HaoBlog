"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();

  return (
    <button type="button"
      onClick={() => router.push('/posts')}
      className="glass-strong group mb-8 inline-flex w-max items-center gap-2 rounded-pill px-4 py-2 text-sm font-bold text-ink-3 shadow-sm transition-all duration-300 hover:text-accent cursor-pointer outline-none"
    >
      <ArrowLeft className="w-4 h-4 transform transition-transform group-hover:-translate-x-1" />
      返回上一级
    </button>
  );
}
