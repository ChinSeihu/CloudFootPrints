"use client";

import { useState } from "react";
import { useAuth } from "@/components/Auth/AuthContext";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { fieldCls } from "@/components/Map/formStyles";
import { IconPin } from "@/components/icons";
import { PRESET_COVERS } from "@/lib/covers";

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
    } catch {
      /* 忽略 */
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
    } catch {
      /* 忽略 */
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
    setSignature(user!.signature ?? "");
    setHometown(user!.hometown ?? "");
    setStatus(user!.status ?? "");
    setAvatarUrl(user!.avatarUrl ?? "");
    setCoverUrl(user!.coverUrl ?? "");
    setEditing(true);
  }

  const cover = editing ? coverUrl || null : user.coverUrl;
  const hasCover = !!cover;

  return (
    <div className="px-4 pt-4 pb-2">
      <div
        className={`relative overflow-hidden rounded-2xl border border-black/5 shadow-sm p-4 ${
          hasCover ? "bg-neutral-800" : "bg-gradient-to-br from-blue-50 via-white to-rose-50/60"
        }`}
        style={hasCover ? { backgroundImage: `url("${cover}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {/* 有背景图时压一层暗色遮罩保证文字可读；无背景时角落柔光 */}
        {hasCover ? (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/30 to-black/25" />
        ) : (
          <div className="pointer-events-none absolute -top-10 -right-8 w-28 h-28 rounded-full bg-blue-200/30 blur-2xl" />
        )}

        <div className="relative flex items-start gap-3.5">
          <div className="rounded-full ring-2 ring-white shadow-sm shrink-0">
            <Avatar url={editing ? avatarUrl || null : user.avatarUrl} name={user.username} size={64} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className={`font-semibold text-[17px] truncate ${hasCover ? "text-white drop-shadow" : "text-neutral-900"}`}>
              {user.username}
            </div>
            {user.status && !editing && (
              <div className={`text-xs mt-0.5 leading-snug line-clamp-2 break-words ${hasCover ? "text-white/85" : "text-neutral-500"}`}>
                {user.status}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0 pt-1">
            {editing ? (
              <button type="button" onClick={() => setEditing(false)} className={`text-xs ${hasCover ? "text-white/80" : "text-neutral-400"}`}>取消</button>
            ) : (
              <>
                <button type="button" onClick={startEdit} className={`text-xs font-medium ${hasCover ? "text-white" : "text-blue-600"}`}>编辑资料</button>
                <button type="button" onClick={logout} className={`text-xs ${hasCover ? "text-white/70" : "text-neutral-400"}`}>登出</button>
              </>
            )}
          </div>
        </div>

        {!editing && (user.signature || user.hometown) && (
          <div className="relative mt-3">
            {user.signature && (
              <p className={`text-sm leading-relaxed ${hasCover ? "text-white/95 drop-shadow" : "text-neutral-600"}`}>{user.signature}</p>
            )}
            {user.hometown && (
              <span
                className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[11px] border ${
                  hasCover ? "bg-white/20 text-white border-white/30" : "bg-white/70 text-neutral-500 border-black/5"
                }`}
              >
                <IconPin className="w-3 h-3" />
                常住地 · {user.hometown}
              </span>
            )}
          </div>
        )}

        {editing && (
          <div className="relative mt-3 space-y-2.5">
            {canUpload && (
              <div className="flex items-center gap-4">
                <label className={`inline-flex items-center gap-2 text-xs cursor-pointer ${hasCover ? "text-white" : "text-blue-600"}`}>
                  {uploading ? "头像上传中…" : "更换头像"}
                  <input type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
                </label>
                <label className={`inline-flex items-center gap-2 text-xs cursor-pointer ${hasCover ? "text-white" : "text-blue-600"}`}>
                  {coverUploading ? "背景上传中…" : "更换背景"}
                  <input type="file" accept="image/*" onChange={pickCover} className="hidden" />
                </label>
                {coverUrl && (
                  <button type="button" onClick={() => setCoverUrl("")} className={`text-xs ${hasCover ? "text-white/70" : "text-neutral-400"}`}>
                    移除背景
                  </button>
                )}
              </div>
            )}
            {/* 莫奈预设背景，可直接选 */}
            <div>
              <div className={`text-[11px] mb-1.5 ${hasCover ? "text-white/80" : "text-neutral-400"}`}>选择背景（莫奈）</div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {PRESET_COVERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCoverUrl(c.url)}
                    title={c.name}
                    className={`relative shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition ${
                      coverUrl === c.url ? "border-blue-500" : hasCover ? "border-white/40" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.url} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
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
