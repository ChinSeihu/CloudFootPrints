"use client";

import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth/AuthContext";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { fieldCls } from "@/components/Map/formStyles";
import { IconPin, IconSparkles } from "@/components/icons";
import { PRESET_COVERS } from "@/lib/covers";
import type { PublicUser } from "@/lib/auth";
import { MascotPicker } from "@/components/Mascot/Mascot";
import { useLanguage } from "@/components/I18n/LanguageProvider";
import type { AppLanguage } from "@/i18n/config";

type FollowMode = "following" | "followers";
type FollowStats = { followingCount: number; followerCount: number };
type FollowListItem = { user: PublicUser; mutual: boolean };

function Avatar({ url, name, size = 68 }: { url: string | null; name: string; size?: number }) {
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

function KnotIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8c2.6-3.2 7.4-3.2 10 0 2.2 2.7.2 7-3.4 7H10.4C6.8 15 4.8 10.7 7 8Z" />
      <path d="M9 16c1.6 2.3 4.4 2.3 6 0" />
      <path d="M8 12h8" />
    </svg>
  );
}

/**
 * Signature: `function ProfileHeader(): React.JSX.Element | null`
 * Purpose: Render and edit the signed-in user's profile, social summary, and local IP presentation preference.
 */
/**
 * Signature: `function ProfileHeader(): React.JSX.Element`
 * Purpose: Displays profile editing and follower lists above global navigation with image-upload and message-loading feedback.
 */
export function ProfileHeader() {
  const router = useRouter();
  const { user, setUser, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signature, setSignature] = useState(user?.signature ?? "");
  const [hometown, setHometown] = useState(user?.hometown ?? "");
  const [status, setStatus] = useState(user?.status ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [coverUrl, setCoverUrl] = useState(user?.coverUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [followStats, setFollowStats] = useState<FollowStats>({ followingCount: 0, followerCount: 0 });
  const [followMode, setFollowMode] = useState<FollowMode | null>(null);
  const [followUsers, setFollowUsers] = useState<FollowListItem[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [followActionId, setFollowActionId] = useState<string | null>(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState<FollowListItem | null>(null);

  const canUpload = cloudinaryConfigured();

  useEffect(() => {
    if (!user) return;
    fetch("/api/users/follows")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.stats && setFollowStats(data.stats))
      .catch(() => {});
  }, [user?.id]);

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
    setMenuOpen(false);
    setEditing(true);
  }

  async function openFollowList(mode: FollowMode) {
    setFollowMode(mode);
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/users/follows?type=${mode}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFollowUsers(data.users ?? []);
        if (data.stats) setFollowStats(data.stats);
      } else {
        setFollowUsers([]);
      }
    } finally {
      setFollowLoading(false);
    }
  }

  async function followBack(item: FollowListItem) {
    if (followActionId) return;
    setFollowActionId(item.user.id);
    try {
      const res = await fetch("/api/users/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: item.user.id, active: true }),
      });
      if (!res.ok) return;
      setFollowUsers((prev) => prev.map((row) => (row.user.id === item.user.id ? { ...row, mutual: true } : row)));
      setFollowStats((prev) => ({ ...prev, followingCount: prev.followingCount + 1 }));
    } finally {
      setFollowActionId(null);
    }
  }

  async function unfollow(item: FollowListItem) {
    if (followActionId) return;
    setFollowActionId(item.user.id);
    try {
      const res = await fetch("/api/users/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: item.user.id, active: false }),
      });
      if (!res.ok) return;
      setFollowUsers((prev) => prev.filter((row) => row.user.id !== item.user.id));
      setFollowStats((prev) => ({ ...prev, followingCount: Math.max(0, prev.followingCount - 1) }));
      setConfirmUnfollow(null);
    } finally {
      setFollowActionId(null);
    }
  }

  const cover = editing ? coverUrl || null : user.coverUrl;
  const avatar = editing ? avatarUrl || null : user.avatarUrl;

  return (
    <div className="px-4 pt-4 pb-2">
      <div
        className={`relative overflow-hidden rounded-2xl border border-black/5 bg-neutral-900 shadow-sm ${
          editing ? "min-h-[170px]" : "min-h-[168px]"
        }`}
        style={cover ? { backgroundImage: `url("${cover}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {!cover && <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-blue-500 to-slate-900" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />

        <div className="absolute right-3 top-3 z-20 flex justify-end">
          {editing ? (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur"
            >
              {t("common.cancel")}
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/25 text-white/90 shadow-sm backdrop-blur"
                aria-label={t("profile.openMenu")}
                aria-expanded={menuOpen}
              >
                <span className="flex flex-col gap-1">
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-10 w-40 overflow-hidden rounded-xl border border-black/5 bg-white py-1 text-sm shadow-lg">
                  <button type="button" onClick={startEdit} className="block w-full whitespace-nowrap px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50">
                    {t("profile.edit")}
                  </button>
                  <button type="button" onClick={logout} className="block w-full whitespace-nowrap px-3 py-2 text-left text-neutral-500 hover:bg-neutral-50">
                    {t("profile.logout")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative px-4 pt-4 pb-4">
          <div className="flex items-end gap-3">
            <div className="rounded-full bg-white/95 p-1 shadow-lg">
              <Avatar url={avatar} name={user.username} size={68} />
            </div>
            <div className="min-w-0 pb-0.5 text-white">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-semibold drop-shadow">{user.username}</h1>
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">Lv.5</span>
              </div>
              {user.status && !editing && (
                <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-white/18 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur">
                  <IconSparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">{user.status}</span>
                </div>
              )}
            </div>
          </div>

          {!editing && (
            <div className="mt-3 space-y-1.5 text-white">
              {user.signature && <p className="line-clamp-2 max-w-[94%] text-xs leading-relaxed text-white/92 drop-shadow">{user.signature}</p>}
              {user.hometown && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/16 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur">
                  <IconPin className="h-3 w-3" />
                  {t("profile.hometownPrefix")} · {user.hometown}
                </span>
              )}
            </div>
          )}

          {!editing && (
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => openFollowList("following")}
                className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white/25"
              >
                {t("profile.followingCount", { count: followStats.followingCount })}
              </button>
              <button
                type="button"
                onClick={() => openFollowList("followers")}
                className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white/25"
              >
                {t("profile.followersCount", { count: followStats.followerCount })}
              </button>
            </div>
          )}

          {editing && (
            <div className="mt-3 space-y-3 rounded-2xl bg-white/95 p-3 shadow-sm backdrop-blur">
              {(uploading || coverUploading) && <LoadingFeedback compact scene="upload" text={t(uploading ? "profile.uploadingAvatar" : "profile.uploadingCover")} />}
              {canUpload && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer text-xs font-medium text-blue-600">
                    {t(uploading ? "profile.uploadingAvatar" : "profile.changeAvatar")}
                    <input type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
                  </label>
                  <label className="cursor-pointer text-xs font-medium text-blue-600">
                    {t(coverUploading ? "profile.uploadingCover" : "profile.changeCover")}
                    <input type="file" accept="image/*" onChange={pickCover} className="hidden" />
                  </label>
                  {coverUrl && (
                    <button type="button" onClick={() => setCoverUrl("")} className="text-xs text-neutral-400">
                      {t("profile.removeCover")}
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
              <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("profile.statusPlaceholder")} className={fieldCls} />
              <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={t("profile.signaturePlaceholder")} className={fieldCls} />
              <input value={hometown} onChange={(e) => setHometown(e.target.value)} placeholder={t("profile.hometownPlaceholder")} className={fieldCls} />
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700">{t("settings.language")}</span>
                  <span className="text-[10px] text-neutral-400">{t("settings.languageHint")}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["zh", "ja", "en"] as const).map((option: AppLanguage) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setLanguage(option)}
                      aria-pressed={language === option}
                      className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${language === option ? "border-violet-500 bg-violet-50 text-violet-700" : "border-neutral-200 bg-white text-neutral-500"}`}
                    >
                      {t(option === "zh" ? "settings.chinese" : option === "ja" ? "settings.japanese" : "settings.english")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700">{t("profile.mascot")}</span>
                  <span className="text-[10px] text-neutral-400">{t("settings.languageHint")}</span>
                </div>
                <MascotPicker />
              </div>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-40"
              >
                {t(saving ? "profile.saving" : "profile.save")}
              </button>
            </div>
          )}
        </div>
      </div>
      {followMode && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 px-4 pb-4 backdrop-blur-sm" onClick={() => setFollowMode(null)}>
          <div className="max-h-[72vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-neutral-950">{t(followMode === "following" ? "profile.following" : "profile.followers")}</h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {t(followMode === "following" ? "profile.followingCount" : "profile.followersCount", { count: followMode === "following" ? followStats.followingCount : followStats.followerCount })}
                </p>
              </div>
              <button type="button" onClick={() => setFollowMode(null)} className="grid h-8 w-8 place-items-center rounded-full bg-neutral-100 text-neutral-500">
                ×
              </button>
            </div>
            <div className="max-h-[56vh] overflow-y-auto px-3 py-2">
              {followLoading && <LoadingFeedback compact scene="message" text={t("profile.loadingFollows")} />}
              {!followLoading && followUsers.length === 0 && (
                <div className="py-10 text-center text-sm text-neutral-400">{t(followMode === "following" ? "profile.noFollowing" : "profile.noFollowers")}</div>
              )}
              {!followLoading && followUsers.map((item) => (
                <div key={item.user.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-neutral-50">
                  <Avatar url={item.user.avatarUrl} name={item.user.username} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-neutral-900">{item.user.username}</span>
                      {item.mutual && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600" title={t("profile.mutual")}>
                          <KnotIcon />
                        </span>
                      )}
                    </div>
                    {(item.user.status || item.user.signature) && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{item.user.status || item.user.signature}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFollowMode(null);
                      router.push(`/me?chat=${encodeURIComponent(item.user.id)}`);
                      window.dispatchEvent(new CustomEvent("tem:open-chat", { detail: item.user.id }));
                    }}
                    aria-label={t("profile.messageUser", { name: item.user.username })}
                    title={t("message.title")}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-violet-600 hover:bg-violet-50"
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
                  </button>
                  {followMode === "following" ? (
                    <button
                      type="button"
                      onClick={() => setConfirmUnfollow(item)}
                      className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                    >
                      {t("profile.unfollow")}
                    </button>
                  ) : item.mutual ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-600">
                      <KnotIcon />
                      {t("profile.mutual")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => followBack(item)}
                      disabled={followActionId === item.user.id}
                      className="shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/20 disabled:opacity-50"
                    >
                      {t(followActionId === item.user.id ? "common.processing" : "profile.followBack")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {confirmUnfollow && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-black/25 px-6" onClick={() => setConfirmUnfollow(null)}>
              <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  <Avatar url={confirmUnfollow.user.avatarUrl} name={confirmUnfollow.user.username} size={42} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-neutral-950">{t("profile.unfollowConfirm", { name: confirmUnfollow.user.username })}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">{t("profile.unfollowHint")}</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmUnfollow(null)}
                    className="h-10 rounded-2xl bg-neutral-100 text-sm font-semibold text-neutral-600"
                  >
                    {t("profile.keep")}
                  </button>
                  <button
                    type="button"
                    onClick={() => unfollow(confirmUnfollow)}
                    disabled={followActionId === confirmUnfollow.user.id}
                    className="h-10 rounded-2xl bg-rose-500 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                  >
                    {t(followActionId === confirmUnfollow.user.id ? "common.processing" : "profile.unfollow")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
