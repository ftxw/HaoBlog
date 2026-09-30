"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Smile } from "lucide-react";
import { useExitAnimation } from "@/app/lib/hooks/use-exit-animation";
import AuthCard, {
  type AuthSubmitPayload,
  type AuthSubmitResult,
} from "@/components/auth/AuthCard";
import {
  saveCommentSession,
  clearCommentSession,
  dropCommentSession,
  loadCommentUser,
  type CommentSessionUser,
} from "@/app/lib/api-client/request";
import { resetLikeStateCache } from "@/app/lib/like-state-cache";
import { unwrapApi } from "@/app/lib/api-types";
import { errorText } from "@/app/lib/response";


interface CommentAuthValue {
  user: CommentSessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<boolean>;
  logout: () => void;
  openLogin: () => void;
  closeLogin: () => void;
  loginOpen: boolean;
}

const CommentAuthContext = createContext<CommentAuthValue | null>(null);

export function useCommentAuth(): CommentAuthValue {
  const ctx = useContext(CommentAuthContext);
  if (!ctx) throw new Error("useCommentAuth 必须在 CommentAuthProvider 内使用");
  return ctx;
}

interface MeData {
  id?: string;
  email?: string;
  nickname?: string;
  avatar?: string;
}

/** 会话探测的结果。 */
type SessionProbe =
  | { kind: "user"; user: CommentSessionUser }
  | { kind: "anonymous" }
  | { kind: "transient" };

async function probeSession(): Promise<SessionProbe> {
  const load = async (): Promise<
    | { k: "unauthorized"; canRefresh: boolean }
    | { k: "ok"; data: MeData | null }
    | { k: "transient" }
  > => {
    let res: Response;
    try {
      res = await fetch("/api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      // 网络层就失败了（离线、连接被中断）—— 同样属于「暂时答不出来」
      return { k: "transient" };
    }
    if (res.status === 401) {
      const body = (await res.json().catch(() => null)) as {
        data?: { canRefresh?: boolean };
      } | null;
      return { k: "unauthorized", canRefresh: Boolean(body?.data?.canRefresh) };
    }
    // 5xx = 服务端故障（含鉴权上游不可用）。不能据此判断会话失效。
    if (res.status >= 500) return { k: "transient" };

    const data = res.ok
      ? unwrapApi<MeData>(await res.json().catch(() => null), res.status)
      : null;
    return { k: "ok", data };
  };

  let r = await load();
  if (r.k === "unauthorized" && r.canRefresh) {
    const refreshed = await fetch("/api/auth/refresh-token", {
      method: "POST",
      credentials: "same-origin",
    })
      .then((x) => x.ok)
      .catch(() => false);
    if (refreshed) r = await load(); // 只重试一次
  }

  if (r.k === "transient") return { kind: "transient" };
  if (r.k === "unauthorized") return { kind: "anonymous" };

  const d = r.data;
  if (!d?.email) return { kind: "anonymous" };
  const email = d.email;
  return {
    kind: "user",
    user: {
      id: d.id || email,
      email,
      nickname: d.nickname || email.split("@")[0],
      avatar: d.avatar || "",
    },
  };
}

export default function CommentAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<CommentSessionUser | null>(() => loadCommentUser());
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let active = true;
    probeSession()
      .then((r) => {
        if (!active) return;
        if (r.kind === "transient") {
          // 服务端暂时答不出来 → 保留现状：继续用 loadCommentUser() 那个本地快照。
          return;
        }
        if (r.kind === "user") {
          saveCommentSession(r.user);
          setUser(r.user);
          return;
        }
        dropCommentSession();
        setUser(null);
      })
      .catch(() => {
      });
    return () => {
      active = false;
    };
  }, []);

  const applySession = useCallback(async () => {
    const r = await probeSession();
    // transient / anonymous 都不动现状：前者是服务端故障（保持本地快照）。
    if (r.kind !== "user") return;
    saveCommentSession(r.user);
    /* 登录/注册成功后清一次点赞状态缓存。 */
    resetLikeStateCache();
    setUser(r.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      await applySession();
      setLoginOpen(false);
    },
    [applySession]
  );

  const register = useCallback(
    async (email: string, password: string, nickname: string) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nickname }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      const data = unwrapApi<{ needsConfirm: boolean }>(
        await res.json().catch(() => null),
        res.status
      );
      if (data.needsConfirm) return true; // 需邮箱确认
      await applySession();
      setLoginOpen(false);
      return false;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    clearCommentSession();
    // 登出后必须丢掉本标签页缓存的点赞状态，否则当前页面会残留上一个账号的点赞高亮。
    resetLikeStateCache();
    setUser(null);
  }, []);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  const value = useMemo<CommentAuthValue>(
    () => ({ user, login, register, logout, openLogin, closeLogin, loginOpen }),
    [user, login, register, logout, openLogin, closeLogin, loginOpen]
  );

  return (
    <CommentAuthContext.Provider value={value}>
      {children}
      <CommentLoginModal />
    </CommentAuthContext.Provider>
  );
}

function CommentLoginModal() {
  const { loginOpen, closeLogin, login, register } = useCommentAuth();

  const { mounted: modalMounted, exiting: modalExiting } = useExitAnimation(
    loginOpen,
    200,
  );

  const handleSubmit = async ({
    mode,
    email,
    password,
    nickname,
  }: AuthSubmitPayload): Promise<AuthSubmitResult | void> => {
    if (mode === "login") {
      await login(email, password);
      return;
    }
    const needConfirm = await register(email, password, nickname);
    if (needConfirm) return { info: "注册成功，请前往邮箱完成确认后再登录" };
  };

  return (
    <>
      {modalMounted && (
        <div
          data-exiting={modalExiting}
          className="exit-fade fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={closeLogin}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="enter-pop exit-fade-scale w-full max-w-sm"
          >
            <AuthCard
              onClose={closeLogin}
              onSubmit={handleSubmit}
              footer={
                <>
                  <Smile className="w-3 h-3" />
                  评论需登录真实账号，未注册请切换到「注册」
                </>
              }
            />
          </div>
        </div>
      )}
    </>
  );
}
