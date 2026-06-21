// 统一头像：有 avatarUrl 显示图片，否则显示用户名首字母圆底。
type AvatarUser = { username: string; avatarUrl: string | null } | null | undefined;

export function Avatar({ user, size = 32 }: { user: AvatarUser; size?: number }) {
  if (user?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  const name = user?.username ?? "用户";
  return (
    <div
      className="rounded-full bg-blue-100 text-blue-600 font-semibold grid place-items-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
