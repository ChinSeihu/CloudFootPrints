"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import { fieldCls } from "@/components/Map/formStyles";

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

  return (
    <div className="max-w-sm mx-auto px-6 py-12">
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
    </div>
  );
}
