import { defineConfig, env } from "@prisma/config";

// Prisma 7 配置文件。迁移 / introspection 用到的连接 URL 在这里读取。
// 运行时（PrismaClient）则通过 src/lib/db.ts 里的 driver adapter 连接。
try {
  // Prisma 7 不再自动加载 .env，手动加载（Node 20.6+ / 24 内置）。
  process.loadEnvFile(".env");
} catch {
  // 没有 .env 文件时用真实环境变量。
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
