"use client";

import { useState } from "react";
import { useAuth } from "@/components/Auth/AuthContext";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { fieldCls } from "@/components/Map/formStyles";
import { IconPin, IconSparkles } from "@/components/icons";
import { PRESET_COVERS } from "@/lib/covers";

function Avatar({ url, name, size = 72 }: { url: string | null; name: string; size?: number }) {
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

export function ProfileHeader() {
  const { user, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [signature, setSignature] = useState(user?.signature ?? "");
  const [hometown, setHometown] = useState(user?.hometown ?? "");
  const [status, setStatus] = useState(user?.status ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [coverUrl, setCoverUrl] = useState(user?.coverUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
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
    } finally {
      setUploading(false);
    }
  }

  async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverUploading(true);
    try {
      const blob = await compressImage(f);
      setCoverUrl(await uploadToCloudinary(blob));
    } finally {
      setCoverUploading(false);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, hometown, status, avatarUrl, coverUrl }),
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
    if (!user) return;
    setSignature(user.signature ?? "");
    setHometown(user.hometown ?? "");
    setStatus(user.status ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
    setCoverUrl(user.coverUrl ?? "");
    setEditing(true);
  }

  const cover = editing ? coverUrl || null : user.coverUrl;
  const avatar = editing ? avatarUrl || null : user.avatarUrl;

  return (
    <div className="px-4 pt-4 pb-2">
      <div
        className="relative min-h-[230px] overflow-hidden rounded-2xl border border-black/5 bg-neutral-900 shadow-sm"
        style={cover ? { backgroundImage: `url("${cover}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {!cover && <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-blue-500 to-slate-900" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />

        <div className="relative flex items-start justify-between px-4 pt-4">
          <button
            type="button"
            onClick={editing ? () => setEditing(false) : startEdit}
            className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur"
          >
            {editing ? "取消" : "编辑资料"}
          </button>
          {!editing && (
            <button type="button" onClick={logout} className="rounded-full bg-black/25 px-3 py-1.5 text-xs text-white/85 backdrop-blur">
              登出
            </button>
          )}
        </div>

        <div className="relative px-4 pt-12 pb-4">
          <div className="flex items-end gap-3">
            <div className="rounded-full bg-white/95 p-1 shadow-lg">
              <Avatar url={avatar} name={user.username} size={74} />
            </div>
            <div className="min-w-0 pb-1 text-white">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-semibold drop-shadow">{user.username}</h1>
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">Lv.5</span>
              </div>
              {user.status && !editing && (
                <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-white/18 px-2 py-1 text-xs text-white/90 backdrop-blur">
                  <IconSparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{user.status}</span>
                </div>
              )}
            </div>
          </div>

          {!editing && (
            <div className="mt-4 space-y-2 text-white">
              {user.signature && <p className="max-w-[92%] text-sm leading-relaxed text-white/92 drop-shadow">{user.signature}</p>}
              {user.hometown && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/16 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur">
                  <IconPin className="h-3.5 w-3.5" />
                  常住地 · {user.hometown}
                </span>
              )}
            </div>
          )}

          {editing && (
            <div className="mt-4 space-y-3 rounded-2xl bg-white/95 p-3 shadow-sm backdrop-blur">
              {canUpload && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer text-xs font-medium text-blue-600">
                    {uploading ? "头像上传中..." : "更换头像"}
                    <input type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
                  </label>
                  <label className="cursor-pointer text-xs font-medium text-blue-600">
                    {coverUploading ? "背景上传中..." : "更换背景"}
                    <input type="file" accept="image/*" onChange={pickCover} className="hidden" />
                  </label>
                  {coverUrl && (
                    <button type="button" onClick={() => setCoverUrl("")} className="text-xs text-neutral-400">
                      移除背景
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {PRESET_COVERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCoverUrl(c.url)}
                    title={c.name}
                    className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      coverUrl === c.url ? "border-blue-500" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.url} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="状态 / 此刻心情" className={fieldCls} />
              <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="个性签名" className={fieldCls} />
              <input value={hometown} onChange={(e) => setHometown(e.target.value)} placeholder="常住地（可选）" className={fieldCls} />
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-40"
              >
                {saving ? "保存中..." : "保存资料"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
