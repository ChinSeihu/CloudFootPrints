import "./loadEnv";
import { prisma } from "../src/lib/db";

/**
 * 给已存在的测试账号填充「真人化」的足迹与发帖数据。
 * - 按人设造日记式备注、真实地点坐标、跨多周时间线、部分配图。
 * - 配图：把按分类挑好的真实活动图（walkerplus/jalan）通过 Cloudinary unsigned
 *   upload 以「远程 URL 抓取」方式上传，得到自带 CORS 的 Cloudinary 链接
 *   （与真人上传一致；地图圆形缩略图也能正常显示）。
 * - 可重复执行：每次先清掉该用户旧的足迹/发帖再重灌。
 * - 只处理库里已存在的 demo 用户（登录过即存在），不存在则跳过。
 */

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

// 把远程图片让 Cloudinary 服务端抓取并托管，返回 secure_url。带缓存避免重复上传同一张。
// 若 Cloudinary 未配置好（如 upload preset 无效），降级为直接用源 URL（图片仍可在列表/弹窗显示，
// 只是地图圆形缩略图因跨域回退脚印）；修好 preset 后重跑本脚本即可迁入 Cloudinary。
let cloudinaryWarned = false;
const uploadCache = new Map<string, string>();
async function toCloudinary(remoteUrl: string): Promise<string> {
  if (uploadCache.has(remoteUrl)) return uploadCache.get(remoteUrl)!;
  let result = remoteUrl;
  if (CLOUD && PRESET) {
    try {
      const form = new FormData();
      form.append("file", remoteUrl); // unsigned upload 接受远程 URL，服务端抓取（绕过 CORS）
      form.append("upload_preset", PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      result = ((await res.json()) as { secure_url: string }).secure_url;
    } catch (e) {
      if (!cloudinaryWarned) {
        console.warn(`⚠️ Cloudinary 上传失败，降级为直接使用源图 URL（地图缩略图会回退脚印）。请检查 NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET 是否为有效的 unsigned 预设名。\n   ${e instanceof Error ? e.message : e}`);
        cloudinaryWarned = true;
      }
    }
  }
  uploadCache.set(remoteUrl, result);
  return result;
}

// 按人设分类挑的真实活动图（walkerplus / jalan，确保可访问；由 Cloudinary 服务端抓取）。
const SRC = {
  exhibition: [
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/68/l/583568_1.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/30/l/593530_1.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/54/l/584754.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/22/l/570922.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/09/l/583109.jpg",
  ],
  live: [
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/10/l/580810.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/90/l/595490.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/03/l/595703.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/03/l/594203.jpg",
  ],
  market: [
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/12/l/580212.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/65/l/591665.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/96/l/594896.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/63/l/591663.jpg",
  ],
  festival: [
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/18/l/595018.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/43/l/466743_1.jpg",
    "https://www.jalan.net/jalan/img/8/event/0358/KXL/e358692a.jpg",
    "https://www.jalan.net/jalan/img/8/event/0358/KXL/e358706a.jpg",
    "https://www.jalan.net/jalan/img/8/event/0358/KXL/e358626a.jpg",
  ],
  cafe: [
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/89/l/596989.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/26/l/581726.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/62/l/406362_2.jpg",
    "https://ms-cache.walkerplus.com/walkertouch/wtd/event/34/l/466434_3.jpg",
  ],
} as const;

type CI = { note: string; rating: number; lat: number; lng: number; daysAgo: number; photos?: string[] };
type PO = {
  title: string;
  category: string;
  description: string;
  venueName: string;
  lat: number;
  lng: number;
  daysFromNow: number;
  tags: string[];
  signupEnabled?: boolean;
  image?: string;
};

const DATA: Record<string, { checkins: CI[]; posts: PO[] }> = {
  // 展览 / 美术馆控（渋谷区）
  "さくら": {
    checkins: [
      { note: "终于抢到草间弥生的票。无限镜屋里只待了短短一分钟，出来还有点恍惚。小南瓜比照片里更可爱，拍了一整卷。", rating: 5, lat: 35.7156, lng: 139.7251, daysAgo: 41, photos: [SRC.exhibition[0], SRC.exhibition[1]] },
      { note: "周中下午的国立新美术馆人很少，靠窗的咖啡座坐了一个多小时。看展是其次，发呆才是正事。", rating: 4, lat: 35.6652, lng: 139.7269, daysAgo: 27 },
      { note: "脱了鞋走进 teamLab 的水里那一瞬间，莫名有点想哭，说不清为什么，大概是光太温柔了。", rating: 5, lat: 35.6499, lng: 139.7906, daysAgo: 18, photos: [SRC.exhibition[2]] },
      { note: "藏在谷中小巷里的画廊，由老澡堂改的。安静到能听见自己的呼吸，看了三幅画就舍不得走。", rating: 4, lat: 35.7205, lng: 139.766, daysAgo: 10 },
      { note: "看完展和朋友在 Bunkamura 附近喝到打烊，从草间弥生一路聊到各自的近况。好久没这样了。", rating: 4, lat: 35.6595, lng: 139.6975, daysAgo: 3, photos: [SRC.exhibition[3]] },
    ],
    posts: [
      { title: "莫奈与印象派的光 · 特展", category: "EXHIBITION", description: "国立西洋美术馆的新特展，借了好几幅平时见不到的睡莲。强烈建议工作日上午去，人少光好。我已经去了两次了。", venueName: "国立西洋美术馆", lat: 35.7156, lng: 139.7763, daysFromNow: 5, tags: ["展览", "印象派", "限定"], image: SRC.exhibition[4] },
    ],
  },
  // Live house 常客 / 摇滚（下北沢）
  "ケンジ": {
    checkins: [
      { note: "今晚主唱嗓子整个炸开，安可连唱两首，散场了耳朵还在嗡嗡响。买了张签名碟，值。", rating: 5, lat: 35.6613, lng: 139.6679, daysAgo: 34, photos: [SRC.live[0]] },
      { note: "三组乐队拼盘，第二组完全是黑马。回家立刻把他们的歌单循环到睡着。", rating: 4, lat: 35.6952, lng: 139.7006, daysAgo: 22 },
      { note: "在书店街碰到街头演出，站着听了四首才舍得走。下北沢永远不缺这种惊喜。", rating: 4, lat: 35.661, lng: 139.6685, daysAgo: 13, photos: [SRC.live[1]] },
      { note: "站票第二排，被人潮推着也心甘情愿。鼓点像直接踩在心脏上。", rating: 5, lat: 35.6939, lng: 139.7029, daysAgo: 5 },
    ],
    posts: [
      { title: "周五夜 · 三组地下乐队拼盘", category: "LIVE", description: "认识的几支下北沢乐队凑的一场。风格从车库到后摇都有，门票含一杯饮料。想认识同好的来，散场一起去横丁喝一杯。", venueName: "下北沢 SHELTER", lat: 35.6613, lng: 139.6679, daysFromNow: 4, tags: ["音乐", "夜场", "Live"], signupEnabled: true, image: SRC.live[2] },
    ],
  },
  // 市集与古着控（吉祥寺）
  "小林ゆい": {
    checkins: [
      { note: "大江户骨董市淘到一只昭和年代的玻璃杯，老板还多送了我一个小碟子。早起赶集果然有好货。", rating: 5, lat: 35.6772, lng: 139.7637, daysAgo: 31, photos: [SRC.market[0]] },
      { note: "试了一件 80 年代的风衣，版型绝了，犹豫到店要关门，最后还是抱回了家。", rating: 4, lat: 35.703, lng: 139.58, daysAgo: 23, photos: [SRC.market[1]] },
      { note: "和店主聊了快一个小时的针脚和年份，买不买都很开心。这种店越来越少了。", rating: 4, lat: 35.6618, lng: 139.6671, daysAgo: 14 },
      { note: "二手书、旧唱片、手作摊摆了一整片，逛了一下午，背包越来越重，脚步越来越慢。", rating: 4, lat: 35.71, lng: 139.57, daysAgo: 6, photos: [SRC.market[2]] },
    ],
    posts: [
      { title: "周末手作 & 古着小市集", category: "MARKET", description: "约了几个做手作的朋友一起摆摊，有陶器、银饰和我自己收的古着。早来有手冲咖啡喝。下雨顺延一周。", venueName: "吉祥寺 井之头公园旁", lat: 35.7003, lng: 139.5704, daysFromNow: 6, tags: ["市集", "古着", "手作"], image: SRC.market[3] },
    ],
  },
  // 祭典摄影爱好者（浅草）
  "たけし": {
    checkins: [
      { note: "雷门前永远是人海，但清晨六点来，能拍到空无一人的仲见世通。为这张图早起值了。", rating: 5, lat: 35.7148, lng: 139.7967, daysAgo: 29, photos: [SRC.festival[0]] },
      { note: "等了两个小时拍晚霞下的天空树，云突然散开的那一刻，按快门的手都在抖。", rating: 5, lat: 35.711, lng: 139.801, daysAgo: 20, photos: [SRC.festival[1]] },
      { note: "神轿抬过来的瞬间整条街都在喊，镜头根本不够用，干脆放下相机用眼睛看。三社祭名不虚传。", rating: 5, lat: 35.7166, lng: 139.7969, daysAgo: 12, photos: [SRC.festival[2]] },
      { note: "祭典结束在小横丁喝了一杯，老板听说我专程来拍祭典，请我吃了一串。东京的人情味。", rating: 4, lat: 35.7135, lng: 139.7935, daysAgo: 4 },
    ],
    posts: [
      { title: "三社祭 · 神轿巡游拍摄点位", category: "FESTIVAL", description: "整理了几个拍神轿的好机位，逆光和顺光都标了。结伴去的可以一起，互相帮忙占位。注意当天人非常多，看好随身物品。", venueName: "浅草神社", lat: 35.7166, lng: 139.7969, daysFromNow: 9, tags: ["祭典", "摄影", "户外"], image: SRC.festival[3] },
    ],
  },
  // 咖啡与小店探店（中目黒）
  "美咲": {
    checkins: [
      { note: "Blue Bottle 的季节限定手冲，柑橘尾韵很干净。靠窗看目黑川的人流，一下午就这么过去了。", rating: 5, lat: 35.6447, lng: 139.699, daysAgo: 36, photos: [SRC.cafe[0]] },
      { note: "买咖啡送了一本小册子，就坐在书架旁读完了。被偏爱的小确幸。", rating: 4, lat: 35.644, lng: 139.6985, daysAgo: 25 },
      { note: "和久违的朋友约在代官山，拿铁拉花是一只猫，舍不得喝。聊到店都准备打烊。", rating: 5, lat: 35.6485, lng: 139.703, daysAgo: 16, photos: [SRC.cafe[1]] },
      { note: "藏在二楼的小店，只有六个座位，老板一个人慢慢冲。慢得刚刚好。", rating: 5, lat: 35.6433, lng: 139.6695, daysAgo: 8, photos: [SRC.cafe[2]] },
      { note: "樱花季早过了，傍晚的目黑川还是好看。买了杯外带边走边喝，是普通又满足的一天。", rating: 4, lat: 35.645, lng: 139.6988, daysAgo: 2 },
    ],
    posts: [
      { title: "中目黒咖啡散步地图（我的私藏）", category: "OTHER", description: "把常去的几家小店串成一条散步路线，从目黑川一路喝到三轩茶屋。每家都写了推荐的那一杯。周末慢慢走刚好半天。", venueName: "中目黒站", lat: 35.6447, lng: 139.699, daysFromNow: 3, tags: ["美食", "咖啡", "散步"], image: SRC.cafe[3] },
    ],
  },
};

async function main() {
  for (const [username, d] of Object.entries(DATA)) {
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) {
      console.warn(`跳过 ${username}：用户不存在（需先登录创建）`);
      continue;
    }
    const userId = user.id;
    await prisma.checkIn.deleteMany({ where: { userId } });
    await prisma.post.deleteMany({ where: { userId } });

    for (const c of d.checkins) {
      const photos = c.photos ? await Promise.all(c.photos.map(toCloudinary)) : [];
      await prisma.checkIn.create({
        data: {
          userId,
          lat: c.lat,
          lng: c.lng,
          note: c.note,
          rating: c.rating,
          photoUrl: photos[0] ?? null,
          photoUrls: photos,
          createdAt: new Date(Date.now() - c.daysAgo * 86400000),
        },
      });
    }
    for (const p of d.posts) {
      const image = p.image ? await toCloudinary(p.image) : null;
      await prisma.post.create({
        data: {
          userId,
          title: p.title,
          category: p.category as never,
          description: p.description,
          venueName: p.venueName,
          lat: p.lat,
          lng: p.lng,
          startTime: new Date(Date.now() + p.daysFromNow * 86400000),
          tags: p.tags,
          signupEnabled: p.signupEnabled ?? false,
          imageUrl: image,
          imageUrls: image ? [image] : [],
        },
      });
    }
    console.log(`${username}: ${d.checkins.length} 足迹, ${d.posts.length} 发帖`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
