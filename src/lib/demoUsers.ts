// 测试账号（当前阶段方便用）：登录页可一键选一个直接登录，首次选择时自动创建。
// 仅含可公开展示的资料；统一口令只在服务端（services/users.ts），不暴露前端。
import { PRESET_COVERS } from "@/lib/covers";

export type DemoUser = {
  username: string;
  signature: string;
  hometown: string;
  status: string;
  coverUrl: string; // 资料卡背景（莫奈预设）
  avatarUrl: string; // 头像（日系动漫，存在 public/avatars/）
};

export const DEMO_USERS: DemoUser[] = [
  { username: "さくら", signature: "展览爱好者，周末都泡在美术馆", hometown: "渋谷区", status: "在看草间弥生展 🎨", coverUrl: PRESET_COVERS[0].url, avatarUrl: "/avatars/sakura.png" },
  { username: "ケンジ", signature: "live house 常客，摇滚不死", hometown: "下北沢", status: "求周末的好演出 🎸", coverUrl: PRESET_COVERS[1].url, avatarUrl: "/avatars/kenji.png" },
  { username: "小林ゆい", signature: "市集与古着控", hometown: "吉祥寺", status: "周末去逛骨董市 🛍️", coverUrl: PRESET_COVERS[2].url, avatarUrl: "/avatars/yui.png" },
  { username: "たけし", signature: "祭典摄影爱好者", hometown: "浅草", status: "准备拍三社祭 📷", coverUrl: PRESET_COVERS[3].url, avatarUrl: "/avatars/takeshi.png" },
  { username: "美咲", signature: "咖啡与小店探店", hometown: "中目黒", status: "新店打卡进行中 ☕", coverUrl: PRESET_COVERS[4].url, avatarUrl: "/avatars/misaki.png" },
];
