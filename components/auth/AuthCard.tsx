"use client";

import { useState } from "react";
import { Loader2, Lock, Mail, UserRound, X } from "lucide-react";

export type AuthMode = "login" | "register";

export interface AuthSubmitPayload {
  mode: AuthMode;
  email: string;
  password: string;
  nickname: string;
}

export interface AuthSubmitResult {
  info?: string;
  error?: string;
  switchTo?: AuthMode;
}

export interface AuthCardProps {
  titles?: Partial<Record<AuthMode, string>>;
  defaultMode?: AuthMode;
  allowRegister?: boolean;
  showNickname?: boolean;
  onSubmit: (payload: AuthSubmitPayload) => Promise<AuthSubmitResult | void>;
  busy?: boolean;
  onClose?: () => void;
  footer?: React.ReactNode;
}

const DEFAULT_TITLES: Record<AuthMode, string> = {
  login: "登录后评论",
  register: "注册账号",
};

const INPUT_CLS =
  "w-full rounded-card-sm border border-hairline bg-transparent pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-4 outline-none focus:border-accent-2 disabled:opacity-60";
const ICON_CLS = "absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-ink-4";

export default function AuthCard({
  titles,
  defaultMode = "login",
  allowRegister = true,
  showNickname = true,
  onSubmit,
  busy = false,
  onClose,
  footer,
}: AuthCardProps) {
  const [mode, setMode] = useState<AuthMode>(
    allowRegister ? defaultMode : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pending = busy || submitting;

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await onSubmit({ mode, email, password, nickname });
      if (res?.info) setInfo(res.info);
      if (res?.error) setError(res.error);
      if (res?.switchTo) setMode(res.switchTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const isRegister = mode === "register";

  return (
    <div className="w-full rounded-card border border-hairline bg-surface-solid p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-ink">
          {titles?.[mode] ?? DEFAULT_TITLES[mode]}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-ink-4 hover:text-ink-2 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {allowRegister && (
        <div className="grid grid-cols-2 gap-1 mb-4 rounded-card-sm bg-surface-muted p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`rounded-md py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                mode === m
                  ? "bg-accent-soft text-accent shadow-sm"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {isRegister && showNickname && (
          <div className="relative">
            <UserRound className={ICON_CLS} />
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="昵称（最多 20 字）"
              maxLength={20}
              required
              disabled={pending}
              className={INPUT_CLS}
            />
          </div>
        )}
        <div className="relative">
          <Mail className={ICON_CLS} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            autoComplete="username"
            required
            disabled={pending}
            className={INPUT_CLS}
          />
        </div>
        <div className="relative">
          <Lock className={ICON_CLS} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? "密码（至少 6 位）" : "密码"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            disabled={pending}
            className={INPUT_CLS}
          />
        </div>

        {error && (
          <div className="rounded-card-sm bg-tone-danger-soft px-3 py-2 text-xs text-tone-danger">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-card-sm bg-tone-success-soft px-3 py-2 text-xs text-tone-success">
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full flex items-center justify-center gap-1.5 rounded-card-sm bg-accent py-2 text-sm font-medium text-accent-ink hover:bg-accent transition-colors disabled:opacity-60 cursor-pointer"
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isRegister ? "注册并登录" : "登 录"}
        </button>
      </form>

      {footer && (
        <div className="mt-4 flex items-center justify-center gap-1 text-center text-[12px] text-ink-4">
          {footer}
        </div>
      )}
    </div>
  );
}
