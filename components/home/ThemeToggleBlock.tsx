"use client";

import { useTheme } from '@/components/providers/ThemeProvider';

export default function ThemeToggleBlock() {
  const { toggleTheme } = useTheme();

  return (
    <div
      role="button"
      tabIndex={0}
      // 不写 aria-label：无障碍名交给内部可见文字计算。
      // 之前固定写「切换夜间 / 日间模式」，与可见的「夜间模式 / 流萤飞舞的深空」不是包含关系，
      // 会被 label-content-name-mismatch 判失败（WCAG 2.5.3）。
      title="切换夜间 / 日间模式"
      onClick={toggleTheme}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTheme();
        }
      }}
      className="glass group relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-card p-6 transition-all duration-700 hover:scale-[1.02]"
    >
      <div className="relative mb-3 h-20 w-20 flex-shrink-0 overflow-hidden rounded-full shadow-inner">
        <div className="tblock-day accent-ring absolute inset-0"></div>
        <div className="tblock-night absolute inset-0 bg-stage"></div>

        <div className="tblock-emoji-day absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl">
          🌸
        </div>
        <div className="tblock-emoji-night absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl">
          ✨
        </div>
      </div>

      <div className="z-10 mt-auto text-center">
        <h2 className="text-xl font-bold text-ink transition-colors duration-500">
          <span className="tblock-label-night">夜间模式</span>
          <span className="tblock-label-day">日间模式</span>
        </h2>
        <p className="mt-1 text-sm font-medium text-ink-3 transition-colors duration-500">
          <span className="tblock-label-night">流萤飞舞的深空</span>
          <span className="tblock-label-day">落樱漫舞的清晨</span>
        </p>
      </div>
    </div>
  );
}
