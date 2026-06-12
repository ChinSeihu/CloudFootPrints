// Cloudinary 直传（unsigned upload preset）。客户端直接上传，不经服务器、不进数据库；
// 只把返回的 secure_url（加上 q_auto,f_auto 交付优化）存进 Event.imageUrl。
// 需要两个公开变量（非密钥）：
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
//   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD && PRESET);
}

export async function uploadToCloudinary(blob: Blob): Promise<string> {
  if (!CLOUD || !PRESET) {
    throw new Error("未配置图床（NEXT_PUBLIC_CLOUDINARY_*）");
  }
  const form = new FormData();
  form.append("file", blob);
  form.append("upload_preset", PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`图片上传失败（${res.status}）`);
  }
  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error("上传返回缺少 URL");
  // 交付时自动压缩 + 自动格式（webp/avif）
  return data.secure_url.replace("/upload/", "/upload/q_auto,f_auto/");
}
