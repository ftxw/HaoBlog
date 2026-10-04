"use client";

import { AlertCircle, Hash, Loader2, RefreshCw, Search } from "lucide-react";
import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { getPosts } from "@/app/lib/api-client";
import { escapeRegExp } from "@/app/lib/utils";

export interface SearchPost {
  id: string;
  title?: string;
  description?: string;
  tags?: string[];
  date?: string;
}

const Highlight = ({ text = '', query = '' }) => {
  if (!query.trim() || !text) return <>{text}</>;

  const safeQuery = escapeRegExp(query);
  const regex = new RegExp(`(${safeQuery})`, 'gi');
  const parts = String(text).split(regex);

  const nodes: ReactNode[] = parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="search-mark">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
  return <>{nodes}</>;
};

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_PANEL_LIMIT = 8;

export default function SearchBar({ posts: initialPosts = [] }: { posts: SearchPost[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  /** 远程结果连同「它是哪个词的」一起存，否则换词后会拿旧结果配新词高亮。 */
  const [remoteResults, setRemoteResults] = useState<{ query: string; items: SearchPost[] } | null>(null);
  const [finishedQuery, setFinishedQuery] = useState('');
  /** 请求失败的那个词。与「真的没搜到」分开，避免把网络故障渲染成空结果。 */
  const [failedQuery, setFailedQuery] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = searchQuery.trim();

  useEffect(() => {
    if (!query) {
      abortRef.current?.abort();
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      getPosts({ status: "published", keyword: query, page: 1, size: SEARCH_PANEL_LIMIT }, controller.signal)
        .then((data) => {
          setFailedQuery('');
          setRemoteResults({
            query,
            items: data.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              tags: p.tags,
              date: (p.published_at || p.created_at || "").replace("T", " "),
            })),
          });
        })
        .catch((err: unknown) => {
          // 换词/清空会 abort 掉上一个请求，这不是故障，不能提示。
          if (err instanceof Error && err.name === "AbortError") return;
          setFailedQuery(query);
        })
        .finally(() => {
          setFinishedQuery(query);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      /* 换词或卸载时取消在途请求，避免旧请求 resolve 后写入当前面板。 */
      abortRef.current?.abort();
    };
  }, [query, retryTick]);

  const retrySearch = () => {
    // 清掉 finished/failed，让 in-flight 判定重新成立（否则重试期间不会显示「搜索中」）。
    setFinishedQuery("");
    setFailedQuery("");
    setRetryTick((t) => t + 1);
  };

  const localResults = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return initialPosts.filter((post) => {
      const titleMatch = (post.title || '').toLowerCase().includes(q);
      const descMatch = (post.description || '').toLowerCase().includes(q);
      const tagMatch = (post.tags || []).some((tag) => tag.toLowerCase().includes(q));
      return titleMatch || descMatch || tagMatch;
    });
  }, [query, initialPosts]);

  /* 只认「这个词的结果」，换词后自然回落本地匹配，不会显示上一个词的结果。 */
  const remoteItems = remoteResults && remoteResults.query === query ? remoteResults.items : null;
  const searchResults = remoteItems ?? localResults;
  /* 未出结果（含 250ms 防抖）且未失败都算搜索中，否则换词瞬间会闪一下「未发现」。 */
  const searching = query !== '' && finishedQuery !== query && failedQuery !== query;
  const searchFailed = query !== '' && failedQuery === query;
  const panelOpen = isOpen && query !== '';

  return (
    <div className="relative z-40 mx-auto w-full max-w-2xl mb-10" ref={containerRef}>
      <form className="group relative" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          className="glass-strong relative z-0 w-full rounded-card py-4 pl-14 pr-6 text-lg font-medium text-ink transition-all placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="搜寻标题、描述或标签..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          autoComplete="off"
          spellCheck="false"
          aria-label="站内搜索"
        />

        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex select-none items-center pl-5">
          <Search className="h-5 w-5 text-ink-4 transition-colors group-focus-within:text-accent" />
        </div>
      </form>

      {panelOpen && (
        <div className="glass-strong absolute left-0 right-0 top-full z-20 mt-4 max-h-[450px] overflow-y-auto rounded-card">
          {searchResults.length > 0 ? (
            <div className="flex flex-col py-3">
              {searchFailed && (
                <div className="mx-6 mb-3 flex items-center justify-between gap-3 rounded-card-sm bg-tone-danger-soft px-3 py-2 text-xs font-medium text-tone-danger">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    远程搜索失败，以下为本地结果
                  </span>
                  <button
                    type="button"
                    onClick={retrySearch}
                    className="shrink-0 cursor-pointer font-bold underline underline-offset-2"
                  >
                    重试
                  </button>
                </div>
              )}
              {searchResults.map((post) => (
                <Link
                  href={`/posts/${post.id}`}
                  key={post.id}
                  onClick={() => setIsOpen(false)}
                  className="group flex flex-col gap-2 border-b border-hairline-soft px-6 py-5 no-underline transition-colors last:border-0 hover:bg-accent-soft"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="line-clamp-1 text-lg font-bold text-ink-2">
                      <Highlight text={post.title} query={searchQuery} />
                    </h4>
                    {post.date && (
                      <span className="mono-num mt-1 shrink-0 rounded-card-sm bg-surface-muted px-2 py-1 text-[10px] text-ink-4">
                        {post.date.split(' ')[0]}
                      </span>
                    )}
                  </div>

                  {post.description && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-ink-3">
                      <Highlight text={post.description} query={searchQuery} />
                    </p>
                  )}

                  {post.tags && post.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {post.tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 rounded-card-sm bg-surface-muted px-2 py-1 text-[10px] font-bold text-ink-3"
                        >
                          <Hash size={10} className="opacity-60" />
                          <Highlight text={tag} query={searchQuery} />
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : searching ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-ink-4" />
              <p className="text-sm font-medium text-ink-3">搜索中…</p>
            </div>
          ) : searchFailed ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tone-danger-soft">
                <AlertCircle className="h-6 w-6 text-tone-danger" />
              </div>
              <p className="font-medium text-ink-3">搜索暂时不可用，请稍后重试</p>
              <button
                type="button"
                onClick={retrySearch}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-pill bg-accent-soft px-4 py-1.5 text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-accent-ink"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                <Search className="h-6 w-6 text-ink-4" />
              </div>
              <p className="font-medium text-ink-3">
                {"数据海中未发现关于 “"}
                <span className="font-bold text-accent">{searchQuery}</span>
                {"” 的踪迹"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
