import Link from "next/link";

export const metadata = {
  title: "页面不存在",
  description: "请求的页面不存在或已被移动。",
};

export default function NotFound() {
  return (
    <div className="container-page relative z-10 flex min-h-[68vh] items-center justify-center py-16">
      <div className="glass rounded-card w-full max-w-xl px-6 py-12 text-center sm:px-10">
        <p className="mono-num text-6xl font-black text-accent sm:text-7xl">404</p>
        <h1 className="mt-4 text-2xl font-black tracking-widest text-ink transition-colors duration-700 sm:text-3xl">
          页面走丢了
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink-3 transition-colors duration-700">
          这个地址下没有内容：可能已被移动、重命名，或者从未存在过。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-pill bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink shadow-lg no-underline transition duration-200 hover:brightness-110"
          >
            回到首页
          </Link>
          <Link
            href="/posts"
            className="rounded-pill border border-hairline px-5 py-2.5 text-sm font-bold text-ink no-underline transition duration-200 hover:border-accent-hairline hover:bg-surface"
          >
            浏览文章
          </Link>
        </div>
      </div>
    </div>
  );
}
