import "./loadEnv";
import { prisma } from "../src/lib/db";
import { ensureDemoUser } from "../src/services/users";

/**
 * 给已存在的测试账号填充「真人化」的足迹与发帖数据。
 * - 按人设造日记式备注、真实地点坐标、跨多周时间线、部分配图。
 * - 配图：每条日记配「内容匹配」的真实主题图（Unsplash），通过 Cloudinary unsigned
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

// 与每条日记「内容匹配」的真实主题图（Unsplash，已逐一验证可达；由 Cloudinary 服务端抓取托管）。
// 按 SRC[persona][i] 的位置对应下方各条 checkin/post，见各条注释。
const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&q=75&auto=format&fit=crop`;
const SRC = {
  // さくら（展览 / 美术馆）
  exhibition: [
    u("1518998053901-5348d3961a04"), // 0 草间弥生·无限镜屋（沉浸光影）
    u("1531913764164-f85c52e6e654"), // 1 草间弥生·展品近景
    u("1492684223066-81342ee5ff30"), // 2 teamLab·数字光影
    u("1554118811-1e0d58224f24"), //    3 看展后小馆夜聊
    u("1577720580479-7d839d829c73"), // 4 (发帖) 印象派绘画特展
  ],
  // ケンジ（live / 摇滚）
  live: [
    u("1470229722913-7c0e2dbbafd3"), // 0 live house 演出
    u("1485579149621-3123dd979885"), // 1 街头吉他演出
    u("1501386761578-eac5c94b800a"), // 2 (发帖) 乐队拼盘舞台
  ],
  // 小林ゆい（市集 / 古着）
  market: [
    u("1452860606245-08befc0ff44b"), // 0 骨董市·旧物
    u("1567696911980-2eed69a46042"), // 1 古着·复古衣架
    u("1524578271613-d550eacf6090"), // 2 二手书 / 旧唱片摊
    u("1441986300917-64674bd600d8"), // 3 (发帖) 手作小市集
  ],
  // たけし（祭典摄影）
  festival: [
    u("1583416750470-965b2707b355"), // 0 浅草寺 / 仲见世
    u("1540959733332-eab4deabeeaf"), // 1 晚霞下的东京天空树
    u("1493780474015-ba834fd0ce2f"), // 2 日本祭典·神轿提灯
    u("1480796927426-f609979314bd"), // 3 (发帖) 东京街景·祭典夜
  ],
  // 美咲（咖啡 / 小店）
  cafe: [
    u("1495474472287-4d71bcdd2085"), // 0 Blue Bottle·手冲靠窗
    u("1461023058943-07fcbe16d735"), // 1 拿铁拉花
    u("1521017432531-fbd92d768814"), // 2 二楼小店·安静咖啡馆
    u("1509042239860-f550ce710b93"), // 3 (发帖) 咖啡散步
  ],
} as const;

// 新增 7 人的主题配图（Unsplash，均已 curl 验证 200；由 Cloudinary 服务端抓取托管）。
const EXTRA = {
  run1: u("1571008887538-b36bb32f4571"),      // 皇居 / 晨跑
  run2: u("1486218119243-13883505764c"),      // 跑步 · 路面
  gym: u("1534438327276-14e5300c3a48"),       // 健身房 · 杠铃
  keyboard: u("1587829741301-dc798b83add3"),  // 机械键盘 / 数码
  soccer1: u("1431324155629-1a6deb1dec8d"),   // 球场看台
  soccer2: u("1574629810360-7efbbe195018"),   // 足球 · 比赛
  onsen: u("1545569341-9eb8b30979d9"),        // 露天温泉
  cinema: u("1489599849927-2ee91cede3ba"),    // 电影院
  dessert1: u("1551024601-bec78aea704b"),     // 甜品 · 蒙布朗类
  beach1: u("1507525428034-b723cf961d3e"),    // 海岸 · 镰仓
  beach2: u("1505228395891-9a51e7e86bf6"),    // 海边 · 黄昏
  izakaya: u("1493857671505-72967e2e2760"),   // 居酒屋夜
  shopping: u("1483985988355-763728e1935b"),  // 古着 / 时尚衣架
  library: u("1521587760476-6c12a4b040da"),   // 图书馆
  cityNight: u("1503899036084-c55cdd92da26"), // 城市夜景 / 运河
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

  // 广告公司职员（港区）— 活泼好胜，工作累。日常/工作为主，兴趣点缀。暂无配图。
  "麻衣": {
    checkins: [
      { note: "第三版提案又被打回来了，组长一句'再想想'就走了。在公司楼下买了杯奶茶站着喝完才有力气回家。24 岁的春天，怎么全是 PPT。", rating: 3, lat: 35.69, lng: 139.7, daysAgo: 38 },
      { note: "和大学同学约在惠比寿，三个人点了一桌还嫌不够，聊各自公司的破事到打烊。原来大家都一样狼狈，突然就没那么丧了。", rating: 5, lat: 35.647, lng: 139.71, daysAgo: 30 },
      { note: "发了工资，冲去表参道把看了一个月的那件外套拿下。试穿时店员说很适合我，虽然知道是客套，还是开心了一路。", rating: 4, lat: 35.665, lng: 139.712, daysAgo: 21, photos: [EXTRA.shopping] },
      { note: "连着加班一周，今天终于准点下班。什么都不想干，瘫在沙发上点了炸鸡配综艺，这就是我的周五夜生活了。", rating: 3, lat: 35.658, lng: 139.73, daysAgo: 12 },
      { note: "提案过了！客户当场拍板那一刻我差点跳起来，组长难得夸了我一句。值了，这两周的命没白拼。", rating: 5, lat: 35.69, lng: 139.7, daysAgo: 4 },
    ],
    posts: [
      { title: "周五下班 · 惠比寿小居酒屋拔草", category: "OTHER", description: "发现一家惠比寿的小居酒屋，串烧和高球都绝，位子不多。周五下班想约人一起，AA，能喝的来！", venueName: "惠比寿横丁", lat: 35.647, lng: 139.71, daysFromNow: 5, tags: ["美食", "聚会"], signupEnabled: true, image: EXTRA.izakaya },
    ],
  },

  // 产品经理（清澄白河）— 理性、工作顺但失激情。倦怠/空虚穿插。暂无配图。
  "陸": {
    checkins: [
      { note: "又一个版本上线，复盘会上大家鼓掌，我却想不起来这三个月到底为什么忙。回家路上在便利店站了五分钟，不知道想买什么。", rating: 3, lat: 35.681, lng: 139.766, daysAgo: 35 },
      { note: "清澄白河的周末仪式：买豆、手冲、看河。一个人的早晨安静得有点过分，但这是这周里我唯一能完全掌控的两小时。", rating: 4, lat: 35.681, lng: 139.8, daysAgo: 27, photos: [SRC.cafe[0]] },
      { note: "去天王洲看了个设计展，动线做得很聪明，忍不住用工作的眼光拆解。看展看成用户体验分析，职业病没救了。", rating: 4, lat: 35.622, lng: 139.75, daysAgo: 18 },
      { note: "下班绕路走了一段没走过的运河，路灯一盏盏亮起来。三十岁快到了，工作没什么可挑的，可越好就越说不清自己想要什么。", rating: 3, lat: 35.679, lng: 139.797, daysAgo: 9, photos: [EXTRA.cityNight] },
      { note: "前同事约咖啡，聊到他裸辞去做独立开发。我嘴上说太冒险，心里却羡慕了一下午。", rating: 3, lat: 35.681, lng: 139.8, daysAgo: 3 },
    ],
    posts: [
      { title: "求推荐：设计/科技类的小众展", category: "EXHIBITION", description: "最近想多看点设计、科技类的展，东京有什么冷门但值得的推荐吗？想给工作之外找点输入。", venueName: "六本木一带", lat: 35.66, lng: 139.729, daysFromNow: 6, tags: ["展览", "城市探索"] },
    ],
  },

  // 大学生 + 咖啡店兼职（三鹰）— 即将毕业、迷茫。就活焦虑与青春治愈交织。暂无配图。
  "葵": {
    checkins: [
      { note: "咖啡店今天超忙，拉花练到手酸，被店长夸了句'最近稳了'。打工是真的累，但被认可的瞬间还是会偷偷开心。", rating: 4, lat: 35.703, lng: 139.58, daysAgo: 33, photos: [SRC.cafe[1]] },
      { note: "攒了好久的票，今晚现场太炸了，全场大合唱时鸡皮疙瘩起来。散场舍不得走，和陌生人在场馆外又聊了半天。", rating: 5, lat: 35.693, lng: 139.745, daysAgo: 25, photos: [SRC.live[0]] },
      { note: "投了第八份简历还是没消息。图书馆坐了一天，看着同学一个个内定，假装淡定其实慌得要死。明天还要早八。", rating: 2, lat: 35.703, lng: 139.566, daysAgo: 16, photos: [EXTRA.library] },
      { note: "井之头公园的天鹅船还是那么蠢萌，和室友逃了下午的课来划船。穷学生的快乐很简单，晒晒太阳就回血了。", rating: 4, lat: 35.7, lng: 139.573, daysAgo: 8 },
      { note: "秋叶原淘到绝版的设定集，店员说是最后一本。抱着它在电车上傻笑，今天的运气大概全用在这了。", rating: 5, lat: 35.699, lng: 139.771, daysAgo: 3 },
    ],
    posts: [
      { title: "求拼：下月一场 live 还有余票", category: "LIVE", description: "下个月有场 live 还有余票，一个人去有点慌，有没有同好一起？学生党，可以拼场内交通。", venueName: "Zepp DiverCity", lat: 35.627, lng: 139.775, daysFromNow: 7, tags: ["演唱会", "Live"], signupEnabled: true },
    ],
  },

  // 软件工程师（目黒）— 有钱没时间、单调。运动充实与孤独并存。暂无配图。
  "悠斗": {
    checkins: [
      { note: "皇居一圈 5 公里，配速比上周快了十秒。清晨的二重桥没什么人，跑起来脑子格外清醒，比开一天会有用多了。", rating: 5, lat: 35.685, lng: 139.752, daysAgo: 36, photos: [EXTRA.run1] },
      { note: "线上出 bug，搞到凌晨两点才回家。打车经过空荡荡的大崎，突然觉得这份高薪买走的好像是我所有的晚上。", rating: 2, lat: 35.62, lng: 139.728, daysAgo: 28 },
      { note: "深蹲加到 100 公斤了，发了张照片到限动，几个朋友点赞。健身房是我现在最稳定的社交场所，想想还有点心酸。", rating: 4, lat: 35.633, lng: 139.7, daysAgo: 19, photos: [EXTRA.gym] },
      { note: "周末两天，除了健身房和超市哪也没去。钱包鼓了，朋友圈空了。三十一岁，是不是该交点不只在工位上的朋友。", rating: 3, lat: 35.633, lng: 139.71, daysAgo: 11 },
      { note: "新键盘到了，敲起来手感太爽，一晚上没干别的就在配列。成年人的快乐，靠买。", rating: 4, lat: 35.633, lng: 139.71, daysAgo: 4, photos: [EXTRA.keyboard] },
    ],
    posts: [
      { title: "约跑：驹沢公园长距离", category: "SPORTS", description: "报了下个月的横滨半马，一个人练有点枯燥。有没有跑友周末在驹沢公园拉个长距离？配速 5'30 上下。", venueName: "駒沢公园", lat: 35.626, lng: 139.662, daysFromNow: 9, tags: ["跑步", "健身"], signupEnabled: true, image: EXTRA.run2 },
    ],
  },

  // 护士（北区）— 轮班疲惫、习惯付出。疲惫与自我治愈交替。暂无配图。
  "七海": {
    checkins: [
      { note: "连上三个夜班，下班时天刚亮，整个人是飘的。回家路上的乌鸦叫得我心烦，洗了澡倒头就睡，连饭都没力气吃。", rating: 2, lat: 35.752, lng: 139.738, daysAgo: 34 },
      { note: "难得的连休，一个人去了趟箱根。泡在露天风吕里看山，热气腾腾的，感觉这半个月的疲惫被泡化了一点。", rating: 5, lat: 35.232, lng: 139.106, daysAgo: 26, photos: [EXTRA.onsen] },
      { note: "白班结束跑去看了场电影，影院里就我一个人，哭得稀里哗啦。当护士久了，眼泪反而藏不住了。", rating: 4, lat: 35.671, lng: 139.764, daysAgo: 17, photos: [EXTRA.cinema] },
      { note: "休息日把积了一周的衣服洗了，阳台晾满，阳光很好。一个人住的好处是安静，坏处也是。", rating: 3, lat: 35.752, lng: 139.738, daysAgo: 9 },
      { note: "下午班前在飞鸟山公园走了走，樱花谢了但绿得很温柔。给自己买了杯热抹茶，难得对自己好一点。", rating: 4, lat: 35.751, lng: 139.737, daysAgo: 3 },
    ],
    posts: [
      { title: "交换一下「一个人安静待着」的去处", category: "OTHER", description: "想整理一份适合一个人安静待着的东京清单——钱汤、深夜咖啡、早场电影。同样需要喘口气的朋友，评论区交换一下？", venueName: "都内", lat: 35.752, lng: 139.738, daysFromNow: 8, tags: ["散步", "电影"] },
    ],
  },

  // 婚礼策划（世田谷）— 见证别人幸福、思考自己。温暖与怅惘。暂无配图。
  "遥": {
    checkins: [
      { note: "今天这对新人在誓词里哭了，新郎的手一直在抖。做这行五年，还是会被这种瞬间打动。送走他们，回家电车上却莫名有点空。", rating: 4, lat: 35.665, lng: 139.712, daysAgo: 37 },
      { note: "自由が丘新开的甜品店，蒙布朗的栗子味很正。一个人坐窗边慢慢吃完，给自己放了半天假。", rating: 5, lat: 35.607, lng: 139.668, daysAgo: 29, photos: [EXTRA.dessert1] },
      { note: "周末去镰仓拍海，光线好得不像话。按下快门那一刻，突然觉得比起策划别人的幸福，这种为自己拍照的时刻更让我安心。", rating: 5, lat: 35.319, lng: 139.55, daysAgo: 20, photos: [EXTRA.beach1] },
      { note: "整理旧照片，翻到三年前自己写的'三十岁前要怎样怎样'。一条都没做到，但好像也没那么糟。", rating: 3, lat: 35.643, lng: 139.66, daysAgo: 11 },
      { note: "和闺蜜在三轩茶屋喝到很晚，她问我有没有想过自己的婚礼。我笑了笑没答上来——擅长成全别人，轮到自己反而不会了。", rating: 3, lat: 35.643, lng: 139.669, daysAgo: 4 },
    ],
    posts: [
      { title: "镰仓拍照小众机位（避人潮）", category: "OTHER", description: "把镰仓适合拍照的几个小众机位整理了一下，避开人潮的时段也标了。喜欢海边、想拍点治愈系的可以参考。", venueName: "镰仓", lat: 35.319, lng: 139.55, daysFromNow: 6, tags: ["摄影", "旅行"], image: EXTRA.beach2 },
    ],
  },

  // 销售（福冈出身，中野）— 来东京第三年，思乡与适应。日常/社交为主。暂无配图。
  "翔太": {
    checkins: [
      { note: "跑了一天客户，被拒了四家，第五家终于签了。在新宿站的人潮里站了会儿，给自己买了个汉堡当庆祝。销售的快乐就这么朴实。", rating: 4, lat: 35.69, lng: 139.7, daysAgo: 35 },
      { note: "去味スタ看球，主队绝杀那一刻整个看台都疯了。和邻座素不相识的大叔击掌拥抱，这种热血，和在博多看球一模一样。", rating: 5, lat: 35.664, lng: 139.527, daysAgo: 27, photos: [EXTRA.soccer1] },
      { note: "便利店看到博多明太子饭团，毫不犹豫买了。味道当然不对，但还是吃出了点家的感觉。来东京三年，这种瞬间越来越少了。", rating: 3, lat: 35.707, lng: 139.665, daysAgo: 18 },
      { note: "中野横丁和同事喝到末班车，聊东京聊老家聊将来。喝多了有点想家，但身边这帮人也挺好，东京慢慢有了'自己人'。", rating: 4, lat: 35.707, lng: 139.665, daysAgo: 10 },
      { note: "周末没安排，扛着相机在谷根千乱逛，拍老猫拍旧店招。一个人的探索也不赖，东京永远逛不完。", rating: 4, lat: 35.725, lng: 139.766, daysAgo: 3 },
    ],
    posts: [
      { title: "约球迷：下场主场一起去味スタ", category: "SPORTS", description: "下场主场比赛想约人一起去味スタ，一个人喊不起来。福冈球迷优先哈哈，其他队也欢迎，散场横丁喝一杯。", venueName: "味の素スタジアム", lat: 35.664, lng: 139.527, daysFromNow: 10, tags: ["足球", "体育"], signupEnabled: true, image: EXTRA.soccer2 },
    ],
  },
};

async function main() {
  for (const [username, d] of Object.entries(DATA)) {
    // 不存在则按 demoUsers 定义自动创建（含新增的 7 人），无需先手动登录。
    const userId = await ensureDemoUser(username);
    if (!userId) {
      console.warn(`跳过 ${username}：不在 DEMO_USERS 中`);
      continue;
    }
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
