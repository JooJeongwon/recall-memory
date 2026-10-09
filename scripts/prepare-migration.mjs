import { spawnSync } from "node:child_process";
import { readdirSync, copyFileSync, existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../node_modules/.bin/supabase", import.meta.url));
if (!existsSync(cli)) throw new Error("먼저 npm install로 고정된 Supabase CLI를 설치하세요.");
function run(args) {
  const result = spawnSync(cli, args, { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("Supabase CLI 실행 실패");
}
run(["--help"]);
if (!existsSync("supabase/config.toml")) {
  run(["init", "--help"]);
  run(["init"]);
}
const config = readFileSync("supabase/config.toml", "utf8");
if (!config.includes("[functions.maintenance]")) appendFileSync("supabase/config.toml", "\n[functions.maintenance]\nverify_jwt = false\n");
if (!config.includes("[auth.email.template.magic_link]")) appendFileSync("supabase/config.toml",
  '\n[auth.email.template.magic_link]\nsubject = "기억할 권리 인증번호"\ncontent_path = "./supabase/templates/otp.html"\n');
run(["migration", "--help"]);
run(["migration", "new", "--help"]);
mkdirSync("supabase/migrations", { recursive: true });
const existing = readdirSync("supabase/migrations");
if (existing.some((name) => name.endsWith("_initial_schema.sql"))) throw new Error("최초 migration이 이미 있습니다. 수정은 새 migration에 작성하세요.");
run(["migration", "new", "initial_schema"]);
const created = readdirSync("supabase/migrations").find((name) => !existing.includes(name) && name.endsWith("_initial_schema.sql"));
if (!created) throw new Error("생성된 migration을 찾지 못했습니다.");
copyFileSync("supabase/schema.sql", `supabase/migrations/${created}`);
