import { spawnSync } from "node:child_process";
import { writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../node_modules/.bin/supabase", import.meta.url));
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const projectId = process.env.SUPABASE_PROJECT_ID;
if (!projectId) throw new Error("SUPABASE_PROJECT_ID에 연결할 개발 프로젝트 ID를 지정하세요.");
for (const args of [["--help"], ["gen", "types", "--help"]]) {
  const result = spawnSync(cli, args, { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("Supabase CLI가 설치되어 있어야 합니다.");
}
const result = spawnSync(cli, ["gen", "types", "typescript", "--project-id", projectId, "--schema", "public"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
if (result.error || result.status !== 0 || !result.stdout.includes("export type Database"))
  throw new Error("DB 타입 생성 실패. Supabase CLI 로그인과 개발 프로젝트 migration 적용을 확인하세요.");
mkdirSync("src/types", { recursive: true });
writeFileSync("src/types/database.ts.tmp", result.stdout);
renameSync("src/types/database.ts.tmp", "src/types/database.ts");
