"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import { fieldCls } from "@/components/Map/formStyles";
import { DEMO_USERS } from "@/lib/demoUsers";

// 登录 / 注册表单（本地账号）。成功后写入全局登录态。
export function AuthForm() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setError(data.error || "操作失败");
        return;
      }
      setUser(data.user);
    } catch {
      setError("网络错误，请稍后再试");
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
        setError(data.error || "登录失败");
        return;
      }
      setUser(data.user);
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-sm mx-auto px-6 py-6 pb-10">
      <h1 className="text-xl font-semibold mb-1">{mode === "login" ? "登录" : "注册"}</h1>
      <p className="text-sm text-neutral-500 mb-6">登录后即可打卡、发帖、评论</p>

      <div className="space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名"
          autoComplete="username"
          className={fieldCls}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={mode === "register" ? "设置密码（至少 6 位）" : "密码"}
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
          {submitting ? "处理中…" : mode === "login" ? "登录" : "注册"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => { setMode((m) => (m === "login" ? "register" : "login")); setError(null); }}
        className="mt-4 text-sm text-blue-600"
      >
        {mode === "login" ? "没有账号？去注册" : "已有账号？去登录"}
      </button>

      {/* 测试账号一键登录（当前阶段方便用） */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-[11px] text-neutral-400">测试账号 · 一键登录</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>
        <div className="space-y-2">
          {DEMO_USERS.map((d) => (
            <button
              key={d.username}
              type="button"
              onClick={() => demoLogin(d.username)}
              disabled={submitting}
              className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-neutral-200 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 font-semibold grid place-items-center shrink-0">
                {d.username.slice(0, 1)}
              </span>
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
