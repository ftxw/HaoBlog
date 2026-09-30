"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { thumbUrlOf } from '@/app/lib/image-thumb';

export interface CarouselPost {
  id: string;
  title: string;
  description: string;
  cover: string;
  formattedDate: string;
}

const COVER_SIZES = '(min-width:1024px) 720px, 100vw';

export default function LatestPostsCarousel({ posts }: { posts: CarouselPost[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (posts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % posts.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [posts.length]);

  if (!posts || posts.length === 0) return null;

  const currentPost = posts[currentIndex];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <Link
        href={currentPost.id === 'none' ? '#' : `/posts/${currentPost.id}`}
        className="absolute inset-0 z-20 no-underline"
        aria-label={`阅读 ${currentPost.title}`}
      />

      {posts.map((post, i) => {
        const hasCover = !!post.cover;
        const isActive = i === currentIndex;
        return (
          <div
            key={post.id}
            className="carousel-slide absolute inset-0 z-0"
            data-active={isActive ? 'true' : 'false'}
            aria-hidden={isActive ? undefined : 'true'}
          >
            {hasCover ? (
              <>
                <SafeImage
                  src={thumbUrlOf(post.cover)}
                  fill
                  priority={i === 0}
                  sizes={COVER_SIZES}
                  alt={post.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="scrim-bottom absolute inset-0 transition-transform duration-1000 group-hover:scale-105" />
              </>
            ) : (
              <div className="absolute inset-0 bg-surface" />
            )}

            <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-pill bg-accent px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent-ink shadow-lg">
                  Latest Insight
                </span>
              </div>
              <h2 className="mb-1.5 text-2xl font-bold text-stage-ink drop-shadow-md">{post.title}</h2>
              <p className="line-clamp-1 text-sm text-stage-ink/80 drop-shadow-sm">{post.description}</p>
            </div>
          </div>
        );
      })}

      {posts.length > 1 && (
        <div className="absolute bottom-4 right-6 z-30 flex gap-2">
          {posts.map((post, i) => (
            <button
              key={post.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // 阻止触发父级的外层跳转
                setCurrentIndex(i);
              }}
              aria-label={`切换到第 ${i + 1} 篇文章`}
              aria-pressed={i === currentIndex}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === currentIndex ? 'w-6 bg-accent' : 'w-2 bg-stage-ink/40 hover:bg-stage-ink/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
