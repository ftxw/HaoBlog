"use client";

import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { thumbUrlOf } from "@/app/lib/image-thumb";
import { ArrowLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import {
  PhotoCard,
  imgFallback,
} from "@/components/photowall/PhotoWallShared";
import AlbumDetailView, {
  type AlbumDetailData,
} from "@/components/photowall/AlbumDetailView";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import Reveal from "@/components/ui/Reveal";
import { useUrlParam } from "@/app/lib/hooks/use-url-param";
import {
  getAlbum,
  searchPhotos,
  type AlbumDetailResponse,
  type PhotoSearchHit,
} from "@/app/lib/api-client";

export interface AlbumPhoto {
  url: string;
  caption?: string;
  takenAt?: string | null;
  w?: number | null;
  h?: number | null;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  cover: string;
  date: string;
  layout: "grid" | "timeline";
  /** 卡片堆叠与封面比例用的预览照片；全量在打开相册时单独取（见 getAlbum） */
  photos: AlbumPhoto[];
  /** 相册真实照片总数（`photos` 只是它的前几张） */
  photoCount: number;
}

function pickStackPhotos(album: Album): [string, string, string] {
  const picked: string[] = [];
  const tryPush = (url: string | undefined) => {
    if (url && !picked.includes(url)) picked.push(url);
  };
  tryPush(album.cover);
  for (const photo of album.photos) {
    if (picked.length >= 3) break;
    tryPush(photo?.url);
  }
  if (picked.length === 0) return ["", "", ""];
  return [picked[0], picked[1 % picked.length], picked[2 % picked.length]];
}

function subscribeAlbumCols(onStoreChange: () => void) {
  const mqLg = window.matchMedia("(min-width: 1024px)");
  const mqSm = window.matchMedia("(min-width: 640px)");
  const onChange = () => onStoreChange();
  mqLg.addEventListener("change", onChange);
  mqSm.addEventListener("change", onChange);
  return () => {
    mqLg.removeEventListener("change", onChange);
    mqSm.removeEventListener("change", onChange);
  };
}

function getAlbumColsSnapshot(): number {
  if (typeof window === "undefined") return 3;
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

function getAlbumColsServerSnapshot(): number {
  return 3;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** 预览照片 → 详情视图数据（全量取不到时的降级，以及首次渲染的兜底） */
function previewToDetail(album: Album): AlbumDetailData {
  return {
    id: album.id,
    title: album.title,
    description: album.description,
    cover: album.cover,
    date: album.date,
    layout: album.layout,
    photos: album.photos.map((p) => ({
      url: p.url,
      caption: p.caption,
      takenAt: p.takenAt,
      w: p.w,
      h: p.h,
    })),
  };
}

function detailFromResponse(
  res: AlbumDetailResponse,
  fallback: Album
): AlbumDetailData {
  return {
    id: res.id,
    title: res.title,
    description: res.description,
    cover: res.cover,
    // 接口不回展示用的日期字符串，沿用列表里已格式化好的那份
    date: fallback.date,
    layout: res.layout,
    photos: res.photos.map((p) => ({
      url: p.url,
      caption: p.caption || undefined,
      takenAt: p.taken_at || undefined,
      w: p.w ?? undefined,
      h: p.h ?? undefined,
    })),
  };
}

/** 打开相册后、全量照片到达前的占位页：保留标题与返回入口，避免闪一下空白 */
function AlbumDetailPlaceholder({
  album,
  onBack,
}: {
  album: Album;
  onBack: () => void;
}) {
  return (
    <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">
      <div className="enter-drop flex flex-col md:flex-row justify-between md:items-end mb-12 gap-4 border-b border-hairline-soft pb-6">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={onBack}
              className="group flex items-center gap-1.5 text-sm font-bold text-ink-4 hover:text-ink transition-colors"
            >
              <span className="glass-strong rounded-lg p-1.5 shadow-sm transition-all duration-300 group-hover:shadow-md">
                <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
              </span>
              返回画廊
            </button>
            <span className="w-1.5 h-1.5 rounded-full bg-hairline"></span>
            <span className="mono-num text-xs font-black text-ink-4 uppercase tracking-widest">
              {album.date}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-ink tracking-wider mb-2">
            {album.title}
          </h1>
          <p className="text-ink-3 font-medium text-lg">{album.description}</p>
        </div>
      </div>
      <div className="flex flex-col items-center py-32 text-ink-4">
        <Loader2 className="mb-4 h-8 w-8 animate-spin opacity-60" aria-hidden="true" />
        <p>正在加载照片…</p>
      </div>
    </div>
  );
}

export default function PhotoWallClient({ initialAlbums }: { initialAlbums: Album[] }) {
  const [albums] = useState<Album[]>(initialAlbums);
  const [activeAlbum, setActiveAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumDetailData | null>(null);
  /** 从搜索结果点进来时要在相册里定位到的那张 */
  const [focusUrl, setFocusUrl] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useUrlParam("q", "");
  // 过渡期间锁定的「上一次提交查询」。activeQuery 由它 + searchQuery 派生。
  const [committedQuery, setCommittedQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const listScrollRef = useRef(0);

  // 非过渡态：searchQuery 变化即时反映（如浏览器前进/后退改 URL）。
  const activeQuery = isTransitioning ? committedQuery : searchQuery.toLowerCase();

  const handleSearchChange = (value: string) => {
    setCommittedQuery(searchQuery.toLowerCase());
    setSearchQuery(value);
    setIsTransitioning(true);
  };

  useEffect(() => {
    if (!isTransitioning) return;
    const timer = setTimeout(() => setIsTransitioning(false), 250);
    return () => clearTimeout(timer);
    // searchQuery 入依赖：每次输入都重置 250ms 防抖计时。
  }, [searchQuery, isTransitioning]);

  // 照片描述搜索必须走服务端：首页每册只下发几张预览。
  const [photoHits, setPhotoHits] = useState<{
    q: string;
    rows: PhotoSearchHit[];
  } | null>(null);
  const photoSearching = Boolean(activeQuery) && photoHits?.q !== activeQuery;
  const matchedPhotos = photoHits?.q === activeQuery ? photoHits.rows : [];

  useEffect(() => {
    if (!activeQuery) return;
    let cancelled = false;
    searchPhotos(activeQuery)
      .then((rows) => {
        if (!cancelled) setPhotoHits({ q: activeQuery, rows });
      })
      .catch(() => {
        // 搜索失败按「没有匹配的照片」处理：相关相册那一段仍照常显示
        if (!cancelled) setPhotoHits({ q: activeQuery, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [activeQuery]);

  const { matchedAlbums } = useMemo(() => {
    if (!activeQuery) return { matchedAlbums: albums };
    return {
      matchedAlbums: albums.filter(
        (album) =>
          album.title.toLowerCase().includes(activeQuery) ||
          album.description.toLowerCase().includes(activeQuery)
      ),
    };
  }, [activeQuery, albums]);

  const albumColsCount = useSyncExternalStore(
    subscribeAlbumCols,
    getAlbumColsSnapshot,
    getAlbumColsServerSnapshot
  );

  const boardRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map());

  const distributedAlbums = useMemo(() => {
    const n = Math.max(1, albumColsCount);
    const cols: Album[][] = Array.from({ length: n }, () => []);
    if (matchedAlbums.length === 0) return cols;
    const gap = 32; // 列内卡片间距 gap-8 = 2rem
    const estimate = (a: Album) => (a.photoCount === 0 ? 280 : 520);
    const colHeights = new Array(n).fill(0);
    for (const album of matchedAlbums) {
      let minIdx = 0;
      for (let i = 1; i < n; i++) {
        if (colHeights[i] < colHeights[minIdx]) minIdx = i;
      }
      cols[minIdx].push(album);
      colHeights[minIdx] += (heights.get(album.id) ?? estimate(album)) + gap;
    }
    return cols;
  }, [matchedAlbums, albumColsCount, heights]);

  useIsomorphicLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const nodes = board.querySelectorAll<HTMLElement>("[data-album-id]");
    let next: Map<string, number> | null = null;
    nodes.forEach((el) => {
      const id = el.dataset.albumId;
      if (!id) return;
      const h = el.offsetHeight;
      if (h > 0 && heights.get(id) !== h) {
        next ??= new Map(heights);
        next.set(id, h);
      }
    });
    if (next) setHeights(next);
  }, [matchedAlbums, albumColsCount, heights]);

  // 打开相册时才去取全量照片：列表里只有几张预览。
  useEffect(() => {
    const album = activeAlbum;
    if (!album) return;
    let cancelled = false;
    getAlbum(album.id)
      .then((res) => {
        if (!cancelled) setAlbumPhotos(detailFromResponse(res, album));
      })
      .catch(() => {
        // 取不到全量就退回预览的几张：比一页空白好，至少能看到相册内容
        if (!cancelled) setAlbumPhotos(previewToDetail(album));
      });
    return () => {
      cancelled = true;
    };
  }, [activeAlbum]);

  const openAlbum = (album: Album, srcPhotoUrl?: string) => {
    listScrollRef.current = window.scrollY;
    setSearchQuery("");
    // 取消过渡态，让派生的 activeQuery 立即回到空串
    setIsTransitioning(false);
    setAlbumPhotos(null);
    setFocusUrl(srcPhotoUrl ?? null);
    setActiveAlbum(album);
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  };

  const renderAlbumCard = (album: Album, index: number) => {
    const [topUrl, midUrl, bottomUrl] = pickStackPhotos(album);
    const ratioSrc = album.photos.find((p) => p.url === album.cover) ?? album.photos[0];
    const ratioW = ratioSrc?.w ?? 4;
    const ratioH = ratioSrc?.h ?? 3;
    return (
    <div key={album.id} data-album-id={album.id} className="w-full">
    <Reveal
      delay={(index % 12) * 0.08}
      onClick={() => openAlbum(album)}
      className="group cursor-pointer flex flex-col items-center transition-transform duration-700 hover:scale-[1.02]"
    >
      <div
        className="relative mx-auto mb-8 w-[85%]"
        style={{ aspectRatio: `${ratioW} / ${ratioH}` }}
      >
        {album.photoCount > 0 && (
          <>
            <div className="absolute inset-0 bg-surface-muted rounded-[4px] shadow-md transform rotate-6 translate-x-4 translate-y-2 group-hover:rotate-12 group-hover:translate-x-8 transition-all duration-700 border-[6px] border-stage-ink overflow-hidden opacity-60">
              {bottomUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- 堆叠背面层用第 3 张照片缩略图，thumb/ 404 需 onError 回退原图
                <img
                  src={thumbUrlOf(bottomUrl)}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => imgFallback(e, bottomUrl)}
                  className="w-full h-full object-cover grayscale blur-[2px]"
                  alt=""
                />
              )}
            </div>
            <div className="absolute inset-0 bg-surface-muted rounded-[4px] shadow-lg transform -rotate-3 -translate-x-2 group-hover:-rotate-6 group-hover:-translate-x-6 transition-all duration-700 border-[6px] border-stage-ink overflow-hidden opacity-80 z-10">
              {midUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- 堆叠中间层用第 2 张照片缩略图，thumb/ 404 需 onError 回退原图
                <img
                  src={thumbUrlOf(midUrl)}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => imgFallback(e, midUrl)}
                  className="w-full h-full object-cover grayscale-[50%]"
                  alt=""
                />
              )}
            </div>
            <div className="relative z-20 overflow-hidden rounded-[4px] border-[6px] border-stage-ink bg-stage-ink shadow-2xl transition-all duration-700 group-hover:-translate-y-2 group-hover:scale-105">
              {topUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- 堆叠顶层用封面缩略图，thumb/ 404 需 onError 回退原图
                <img
                  src={thumbUrlOf(topUrl)}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => imgFallback(e, topUrl)}
                  alt={album.title}
                  className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              )}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-5 opacity-0 transition-opacity duration-700 group-hover:opacity-100">
                <span className="text-lg font-bold text-white drop-shadow-md">{album.photoCount} 张照片</span>
                <span className="mt-1 text-xs font-medium text-accent drop-shadow-md">Click to Open</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="text-center px-4 w-full">
        <div className="flex items-center justify-center gap-2 mb-1">
          <h2 className="text-xl font-bold text-ink transition-colors group-hover:text-accent">{album.title}</h2>
          <span className="mono-num rounded-sm bg-surface-strong px-2 py-0.5 text-xs font-black uppercase tracking-wider text-ink-3">{album.date}</span>
        </div>
        <p className="text-sm text-ink-3 line-clamp-1">{album.description}</p>
      </div>
    </Reveal>
    </div>
    );
  };

  if (activeAlbum) {
    const backToList = () => {
      setActiveAlbum(null);
      setAlbumPhotos(null);
      setFocusUrl(null);
      requestAnimationFrame(() => window.scrollTo({ top: listScrollRef.current }));
    };
    if (!albumPhotos) {
      return <AlbumDetailPlaceholder album={activeAlbum} onBack={backToList} />;
    }
    return (
      <AlbumDetailView
        key={activeAlbum.id}
        data={albumPhotos}
        initialPhotoUrl={focusUrl ?? undefined}
        onBack={backToList}
      />
    );
  }

  return (
    <div className="relative">
      <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">
        <div>
          <PageHeader
            title="光影画廊"
            subtitle="定格时间，封存生活的每一次心跳"
            right={
              <InlineSearch
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="搜索相册名或照片描述..."
                ariaLabel="搜索相册或照片"
              />
            }
          />

          <div className={`transition-all duration-300 ease-in-out ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            {activeQuery && matchedPhotos.length > 0 && (
              <div className="mb-16">
                <h3 className="text-xl font-bold text-ink mb-6 flex items-center gap-2">
                  <span className="w-2 h-6 bg-accent rounded-full"></span>
                  匹配的单张照片 ({matchedPhotos.length})
                </h3>
                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                  {matchedPhotos.map((photo, index) => (
                    <PhotoCard
                      /* key 必须是「哪张照片」。原来用 `albumId-index`：搜索词一变，
                         同一相册同一位置换成了另一张照片，key 却不变 → React 复用实例，
                         PhotoCard 内部的 loaded 状态会张冠李戴。 */
                      key={photo.url}
                      url={photo.url}
                      alt={photo.caption ?? ""}
                      index={index}
                      w={photo.w ?? undefined}
                      h={photo.h ?? undefined}
                      onClick={() => {
                        const album = albums.find((a) => a.id === photo.albumId);
                        if (album) openAlbum(album, photo.url);
                      }}
                      className="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-zoom-in border border-hairline shadow-lg transition-shadow duration-700 hover:shadow-2xl"
                      imgClassName="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                    >
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/10 to-transparent p-5 opacity-0 transition-opacity duration-700 group-hover:opacity-100">
                        <span className="mb-1 text-[10px] font-black uppercase tracking-widest text-accent drop-shadow-md">{photo.albumTitle}</span>
                        <p className="text-sm font-medium text-white drop-shadow-md">{photo.caption}</p>
                      </div>
                    </PhotoCard>
                  ))}
                </div>
              </div>
            )}

            {activeQuery && photoSearching && (
              <p className="mb-8 flex items-center gap-2 text-sm font-medium text-ink-4">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                正在搜索照片…
              </p>
            )}

            {activeQuery && matchedAlbums.length > 0 && (
              <h3 className="text-xl font-bold text-ink mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-accent-2 rounded-full"></span>
                相关相册 ({matchedAlbums.length})
              </h3>
            )}

            {matchedAlbums.length > 0 ? (
              <div ref={boardRef} className="flex gap-8 mt-10 items-start">
                {distributedAlbums.map((col, colIdx) => (
                  <div key={colIdx} className="flex-1 min-w-0 flex flex-col gap-8">
                    {col.map((album, i) => renderAlbumCard(album, i))}
                  </div>
                ))}
              </div>
            ) : matchedPhotos.length === 0 && !photoSearching ? (
              <div className="flex flex-col items-center py-32 text-ink-4">
                <ImageIcon className="mb-4 h-12 w-12 opacity-40" strokeWidth={1.5} aria-hidden="true" />
                <p>
                  {activeQuery
                    ? "在画廊的任何角落都没找到相关的记忆..."
                    : "还没有相册"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
