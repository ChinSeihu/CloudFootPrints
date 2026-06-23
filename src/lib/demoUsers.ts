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

// 社区 12 人（人设详见 docs/demo-personas.md）。
// 1–3、11–12 有动漫头像图；4–10 暂无头像（avatarUrl 留空 → 界面回退用户名首字母圆底）。
// 封面用 6 张莫奈预设循环。
const cover = (i: number) => PRESET_COVERS[i % PRESET_COVERS.length].url;

export const DEMO_USERS: DemoUser[] = [
  { username: "さくら", signature: "展览与书店，周末都泡在美术馆", hometown: "渋谷区", status: "在看草间弥生展 🎨", coverUrl: cover(0), avatarUrl: "/avatars/sakura.png" },
  { username: "ケンジ", signature: "live house 常客，摇滚不死", hometown: "下北沢", status: "求周末的好演出 🎸", coverUrl: cover(1), avatarUrl: "/avatars/kenji.png" },
  { username: "美咲", signature: "咖啡与小店探店，慢慢过日子", hometown: "中目黒", status: "新店打卡进行中 ☕", coverUrl: cover(2), avatarUrl: "/avatars/misaki.png" },
  { username: "麻衣", signature: "广告狗，靠美食和穿搭续命", hometown: "港区", status: "今天也在赶提案 😮‍💨", coverUrl: cover(3), avatarUrl: "" },
  { username: "陸", signature: "PM / 咖啡 / 城市散步", hometown: "清澄白河", status: "在找回对工作的热情", coverUrl: cover(4), avatarUrl: "" },
  { username: "葵", signature: "大学生，在演唱会和打工之间", hometown: "三鹰", status: "毕业前想多看几场 live 🎤", coverUrl: cover(5), avatarUrl: "" },
  { username: "悠斗", signature: "工程师，跑步和健身续命", hometown: "目黒", status: "本周目标 30km 🏃", coverUrl: cover(6), avatarUrl: "" },
  { username: "七海", signature: "护士，轮班间隙找点光", hometown: "北区", status: "下夜班，想泡个温泉 ♨️", coverUrl: cover(7), avatarUrl: "" },
  { username: "遥", signature: "婚礼策划，爱拍照和甜点", hometown: "世田谷", status: "见证别人的幸福中 📷", coverUrl: cover(8), avatarUrl: "" },
  { username: "翔太", signature: "福冈来的，喜欢足球和居酒屋", hometown: "中野", status: "东京第三年，还在适应 ⚽", coverUrl: cover(9), avatarUrl: "" },
  { username: "小林ゆい", signature: "市集与古着控，惜物", hometown: "吉祥寺", status: "周末去逛骨董市 🛍️", coverUrl: cover(10), avatarUrl: "/avatars/yui.png" },
  { username: "たけし", signature: "祭典摄影爱好者", hometown: "浅草", status: "准备拍三社祭 📷", coverUrl: cover(11), avatarUrl: "/avatars/takeshi.png" },
];
