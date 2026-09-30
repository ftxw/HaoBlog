"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { siteConfig } from "@/siteConfig";
import { NAV_LINKS } from "@/app/lib/nav-links";

function normalizePathname(pathname: string): string {
  return pathname === "/index" ? "/" : pathname;
}

function isActive(href: string, pathname: string): boolean {
  const current = normalizePathname(pathname);
  if (href === "/") return current === "/" || current === "";
  return current === href || current.startsWith(href + "/");
}

const brandClass =
  "flex shrink-0 items-center gap-2.5 text-base font-semibold tracking-tight text-ink no-underline select-none";

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toggleTheme } = useTheme();
  const navTitle = useConfigValue("navTitle", siteConfig.navTitle);
  const navSuffix = useConfigValue("navSuffix", siteConfig.navSuffix);
  const navAfter = useConfigValue("navAfter", siteConfig.navAfter);

  const [showNav, setShowNav] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;
      if (currentScrollY > lastScrollY && currentScrollY > 96) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onChange);
    };
  }, []);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileMenuOpen(false);
  }

  const brandText = (
    <>
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_2px_var(--app-accent-soft)]"
        aria-hidden="true"
      />
      <span>
        {navTitle || siteConfig.authorName}
        <span className="mx-1">{navSuffix || "の"}</span>
        {navAfter || "宝藏之地"}
      </span>
    </>
  );

  return (
    <>
      <header
        id="site-nav"
        className="site-nav fixed inset-x-0 top-0 z-50"
        data-hidden={!showNav}
      >
        <div className="glass-bar">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5 sm:px-8">
            {isActive("/", pathname) ? (
              <div className={`${brandClass} cursor-pointer`}>{brandText}</div>
            ) : (
              <Link href="/" className={brandClass}>
                {brandText}
              </Link>
            )}

            <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="主导航">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`nav-item inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm no-underline ${
                      active
                        ? "border-accent-hairline bg-accent-soft font-medium text-accent"
                        : "border-transparent text-ink-3 hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    )}
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="切换主题（浅色 / 深色）"
                title="主题"
                className="group relative inline-flex h-10 w-10 items-center justify-center rounded-pill border border-hairline bg-surface-strong text-ink-2 transition hover:border-accent-hairline hover:text-accent"
              >
                <span className="theme-icon" data-mode="light" aria-hidden="true">
                  <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <span className="theme-icon" data-mode="dark" aria-hidden="true">
                  <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
                aria-controls="nav-drawer"
                aria-expanded={isMobileMenuOpen}
                className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-hairline bg-surface-strong text-ink-2 transition hover:border-accent-hairline hover:text-accent lg:hidden"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  className="h-[18px] w-[18px]"
                  aria-hidden="true"
                >
                  <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
                </svg>
              </button>
            </div>
          </div>

          <div
            id="nav-drawer"
            className="nav-drawer glass-bar border-t border-t-hairline-soft lg:hidden"
            data-open={isMobileMenuOpen}
            inert={!isMobileMenuOpen}
          >
            <nav
              className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-2 sm:px-8 sm:py-4"
              aria-label="移动端导航"
            >
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`glass-strong flex items-center justify-between gap-3 rounded-card-sm px-4 py-3 no-underline transition ${
                      active ? "border-accent-hairline bg-accent-soft" : "hover:border-accent-hairline"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block text-sm font-medium ${active ? "text-accent" : "text-ink"}`}>
                        {link.label}
                      </span>
                      {link.hint && <span className="block text-xs text-ink-4">{link.hint}</span>}
                    </span>
                    <span
                      className={`shrink-0 text-sm ${active ? "text-accent" : "text-ink-4"}`}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <div className="h-16" aria-hidden="true" />
    </>
  );
}
