import "./loadEnv";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { DEFAULT_COVER } from "../src/lib/covers";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const username = (argument("username") ?? process.env.ADMIN_USERNAME ?? "admin").trim();
  const suppliedPassword = argument("password") ?? process.env.ADMIN_PASSWORD;
  const password = suppliedPassword ?? randomBytes(18).toString("base64url");

  if (username.length < 2 || username.length > 20) {
    throw new Error("管理员用户名需 2-20 个字符");
  }
  if (password.length < 12) {
    throw new Error("管理员密码至少 12 位");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      coverUrl: DEFAULT_COVER,
      signature: "内容管理员",
      isAdmin: true,
    },
    update: {
      passwordHash,
      isAdmin: true,
    },
    select: { id: true, username: true, isAdmin: true },
  });

  console.log(JSON.stringify({ ...user, password, generatedPassword: !suppliedPassword }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
