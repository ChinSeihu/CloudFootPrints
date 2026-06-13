"use client";

import { useState } from "react";
import { useAuth } from "@/components/Auth/AuthContext";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { fieldCls } from "@/components/Map/formStyles";
import { IconPin } from "@/components/icons";

function Avatar({ url, name, size = 56 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full bg-blue-100 text-blue-600 font-semibold grid place-items-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

// 个人页顶部：资料展示 + 内联编辑（头像 / 状态 / 签名 / 常住地）+ 登出。
export function ProfileHeader() {
  const { user, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [signature, setSignature] = useState(user?.signature ?? "");
  const [hometown, setHometown] = useState(user?.hometown ?? "");
  const [status, setStatus] = useState(user?.status ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canUpload = cloudinaryConfigured();
  if (!user) return null;

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const blob = await compressImage(f);
      setAvatarUrl(await uploadToCloudinary(blob));
    } catch {
      /* 忽略 */
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, hometown, status, avatarUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setSignature(user!.signature ?? "");
    setHometown(user!.hometown ?? "");
    setStatus(user!.status ?? "");
    setAvatarUrl(user!.avatarUrl ?? "");
    setEditing(true);
  }

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-blue-50 via-white to-rose-50/60 shadow-sm p-4">
        {/* 角落柔光装饰 */}
        <div className="pointer-events-none absolute -top-10 -right-8 w-28 h-28 rounded-full bg-blue-200/30 blur-2xl" />

        <div className="relative flex items-start gap-3.5">
          <div className="rounded-full ring-2 ring-white shadow-sm shrink-0">
            <Avatar url={editing ? avatarUrl || null : user.avatarUrl} name={user.username} size={64} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="font-semibold text-[17px] text-neutral-900 truncate">{user.username}</div>
            {user.status && !editing && (
              <div className="text-xs text-neutral-500 mt-0.5 truncate">{user.status}</div>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0 pt-1">
            {editing ? (
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-400">取消</button>
            ) : (
              <>
                <button type="button" onClick={startEdit} className="text-xs font-medium text-blue-600">编辑资料</button>
                <button type="button" onClick={logout} className="text-xs text-neutral-400">登出</button>
              </>
            )}
          </div>
        </div>

        {!editing && (user.signature || user.hometown) && (
          <div className="relative mt-3">
            {user.signature && <p className="text-sm text-neutral-600 leading-relaxed">{user.signature}</p>}
            {user.hometown && (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-white/70 border border-black/5 text-[11px] text-neutral-500">
                <IconPin className="w-3 h-3" />
                常住地 · {user.hometown}
              </span>
            )}
          </div>
        )}

        {editing && (
          <div className="relative mt-3 space-y-2.5">
            {canUpload && (
              <label className="inline-flex items-center gap-2 text-xs text-blue-600 cursor-pointer">
                {uploading ? "头像上传中…" : "更换头像"}
                <input type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
              </label>
            )}
            <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="状态 / 此刻心情" className={fieldCls} />
            <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="个性签名" className={fieldCls} />
            <input value={hometown} onChange={(e) => setHometown(e.target.value)} placeholder="常住地（可选）" className={fieldCls} />
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存资料"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
