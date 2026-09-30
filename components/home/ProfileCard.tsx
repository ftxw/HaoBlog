"use client";

import Link from "next/link";
import { useConfigImages, useConfigValue } from "@/components/providers/SiteConfigProvider";
import SafeImage from "@/components/ui/SafeImage";

/** 首页个人信息卡。 */
export default function ProfileCard({
  postCount = 0,
  chatterCount = 0,
  photoCount = 0,
}: {
  postCount?: number;
  chatterCount?: number;
  photoCount?: number;
}) {
  const avatarUrl = useConfigValue("avatarUrl");
  const authorName = useConfigValue("authorName");
  const bio = useConfigValue("bio");
  const socialLogos = useConfigImages("socialLogos");

  return (
    <Link
      href="/about"
      className="glass group relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-card p-5 no-underline transition-all duration-700 hover:scale-[1.02] sm:p-6 md:min-h-[280px] md:p-8"
    >
      <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-4 md:gap-6 w-full">
            {avatarUrl && (
              <div className="accent-ring relative h-16 w-16 flex-shrink-0 rounded-card-sm p-1 shadow-lg transition-transform duration-500 group-hover:rotate-3 sm:h-20 sm:w-20 md:h-24 md:w-24">
                <div className="relative h-full w-full overflow-hidden rounded-card-sm bg-surface-strong">
                  <SafeImage
                    src={avatarUrl}
                    alt="avatar"
                    fill
                    sizes="(min-width: 768px) 96px, (min-width: 640px) 80px, 64px"
                    /* 首屏 hero 卡里的头像：Next 实测把它报成 LCP 元素（25s virtual-time 复跑仍如此）。 */
                    priority
                    className="object-cover bg-surface-strong"
                  />
                </div>
              </div>
            )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-ink mb-1 md:mb-2 pb-1 leading-snug tracking-wider transition-colors duration-700 truncate">
              {authorName}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-ink-2 font-medium leading-relaxed max-w-md transition-colors duration-700 line-clamp-2 md:line-clamp-none">
              {bio}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-end justify-between mt-6 md:mt-8 gap-5 md:gap-6 relative z-10">
        <div className="flex gap-2 sm:gap-6 w-full md:w-auto justify-between sm:justify-around md:justify-start px-2 sm:px-0">
          <StatItem count={postCount} label="文章" color="text-accent" />
          <div className="w-px h-8 md:h-10 bg-hairline-soft hidden md:block" aria-hidden="true"></div>
          <StatItem count={chatterCount} label="杂谈" color="text-accent" />
          <div className="w-px h-8 md:h-10 bg-hairline-soft hidden md:block" aria-hidden="true"></div>
          <StatItem count={photoCount} label="照片" color="text-accent" />
        </div>

        {socialLogos.length > 0 && (
          <div className="flex gap-2 md:gap-3 flex-wrap justify-center md:justify-end w-full md:w-auto">
            {socialLogos.slice(0, 5).map((logo, i) => (
              <div key={`${logo}-${i}`} className="relative h-11 w-11 overflow-hidden rounded-card-sm border border-hairline bg-surface-muted shadow-sm md:h-12 md:w-12">
                <SafeImage
                  src={logo}
                  alt={`social-logo-${i + 1}`}
                  fill
                  sizes="(min-width: 768px) 48px, 44px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function StatItem({ count, label, color }: { count: number, label: string, color: string }) {
  return (
    <div className="text-center group/stat px-2">
      <div className={`text-xl md:text-2xl font-black ${color} transition-transform group-hover/stat:scale-110`}>{count}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-widest text-ink-3 md:text-xs">{label}</div>
    </div>
  );
}

