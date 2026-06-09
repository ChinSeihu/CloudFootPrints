// 副作用模块：在任何会读取 env 的模块（如 src/lib/db.ts 的 adapter）被求值前加载 .env。
// 务必把它作为脚本的"第一个 import"，利用 ESM 按 import 顺序求值的特性。
try {
  process.loadEnvFile(".env");
} catch {
  // 没有 .env 时用真实环境变量。
}
export {};
