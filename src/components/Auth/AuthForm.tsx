"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { fieldCls } from "@/components/Map/formStyles";
import { Avatar } from "@/components/common/Avatar";
import { useLanguage } from "@/components/I18n/LanguageProvider";

type DemoLoginUser = {
  username: string;
  avatarUrl: string | null;
  status: string | null;
};

// 登录 / 注册表单（本地账号）。成功后写入全局登录态。
export function AuthForm() {
  const { setUser } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoLoginUser[]>([]);
  const [demoLoading, setDemoLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/demo")
      .then((res) => res.json())
      .then((data: { users?: DemoLoginUser[] }) => {
        if (alive) setDemoUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch(() => {
        if (alive) setDemoUsers([]);
      })
      .finally(() => {
        if (alive) setDemoLoading(false);
      });
    return () => { alive = false; };
  }, []);

  async function submit() {
    if (submitting || !username.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("auth.operationFailed"));
        return;
      }
      setUser(data.user);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function demoLogin(username: string) {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("auth.loginFailed"));
        return;
      }
      setUser(data.user);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-sm mx-auto px-6 py-6 pb-10">
      <h1 className="text-xl font-semibold mb-1">{mode === "login" ? t("auth.login") : t("auth.register")}</h1>
      <p className="text-sm text-neutral-500 mb-6">{t("auth.subtitle")}</p>

      <div className="space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("auth.username")}
          autoComplete="username"
          className={fieldCls}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={mode === "register" ? t("auth.newPassword") : t("auth.password")}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          className={fieldCls}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !username.trim() || !password}
          className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-sm transition active:scale-[0.99] disabled:opacity-40"
        >
          {submitting ? t("common.processing") : mode === "login" ? t("auth.login") : t("auth.register")}
        </button>
      </div>

      <button
        type="button"
        onClick={() => { setMode((m) => (m === "login" ? "register" : "login")); setError(null); }}
        className="mt-4 text-sm text-blue-600"
      >
        {mode === "login" ? t("auth.switchToRegister") : t("auth.switchToLogin")}
      </button>

      {/* 测试账号一键登录（当前阶段方便用） */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-[11px] text-neutral-400">{t("auth.demo")}</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>
        <div className="space-y-2">
          {demoLoading && (
            <div className="p-3 rounded-xl border border-neutral-200 text-xs text-neutral-400">
              {t("auth.loadingDemo")}
            </div>
          )}
          {!demoLoading && demoUsers.length === 0 && (
            <div className="p-3 rounded-xl border border-neutral-200 text-xs text-neutral-400">
              {t("auth.noDemo")}
            </div>
          )}
          {demoUsers.map((d) => (
            <button
              key={d.username}
              type="button"
              onClick={() => demoLogin(d.username)}
              disabled={submitting}
              className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-neutral-200 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <Avatar user={{ username: d.username, avatarUrl: d.avatarUrl }} size={36} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-800">{d.username}</span>
                <span className="block text-xs text-neutral-400 truncate">{d.status}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
