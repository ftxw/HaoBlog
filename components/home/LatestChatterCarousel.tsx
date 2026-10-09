"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { thumbUrlOf } from '@/app/lib/image-thumb';

export interface CarouselChatter {
  id: string;
  title: string;
  description: string;
  cover: string;
  formattedDate: string;
}

const COVER_SIZES = '(min-width:1024px) 470px, (min-width:640px) 66vw, 100vw';

export default function LatestChatterCarousel({ chatters }: { chatters: CarouselChatter[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (chatters.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % chatters.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [chatters.length]);

  if (!chatters || chatters.length === 0) return null;

  return (
    <div className="glass group relative flex h-full w-full min-h-[220px] flex-col overflow-hidden rounded-card transition-all duration-700 hover:scale-[1.02]">
      <Link
        href="/moments"
        className="absolute inset-0 z-20 no-underline"
        aria-label="查看全部说说"
      />

      {chatters.map((chatter, i) => {
        const hasCover = !!chatter.cover;
        const isActive = i === currentIndex;
        return (
          <div
            key={chatter.id}
            className="carousel-slide absolute inset-0 z-0"
            data-active={isActive ? 'true' : 'false'}
            aria-hidden={isActive ? undefined : 'true'}
          >
            {hasCover ? (
              <>
                <SafeImage
                  src={thumbUrlOf(chatter.cover)}
                  fill
                  sizes={COVER_SIZES}
                  alt={chatter.title || 'Chatter Cover'}
                  className="object-cover opacity-80 transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="scrim-bottom absolute inset-0 transition-transform duration-1000 group-hover:scale-105" />
              </>
            ) : (
              <div className="absolute inset-0 bg-surface" />
            )}

            <div className="pointer-events-none absolute inset-0 flex w-full flex-col justify-end p-6 md:w-[85%]">
              <div className="mb-2 flex items-end gap-2">
                <span className="rounded-card-sm border border-stage-hairline bg-stage/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-accent shadow-sm backdrop-blur-sm">
                  Records
                </span>
              </div>

              <h2 className="line-clamp-2 text-2xl font-bold text-stage-ink drop-shadow-md transition-colors group-hover:text-accent-2">
                {chatter.title}
              </h2>
            </div>
          </div>
        );
      })}

      {chatters.length > 1 && (
        <div className="absolute bottom-4 right-6 z-30 flex gap-2">
          {chatters.map((chatter, i) => (
            <button
              key={chatter.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(i);
              }}
              aria-label={`切换到第 ${i + 1} 条说说`}
              aria-pressed={i === currentIndex}
              className={`h-1.5 rounded-full shadow-sm transition-all duration-500 ${
                i === currentIndex ? 'w-6 bg-accent' : 'w-2 bg-stage-ink/40 hover:bg-stage-ink/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
