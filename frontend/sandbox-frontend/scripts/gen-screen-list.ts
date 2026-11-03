import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTES } from "../src/routes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../../../docs/screen-list.md");

const rows = Object.values(ROUTES)
  .map(
    (r) => `| ${r.name} | \`${r.path}\` | ${r.auth ? "✅" : "—"} | ${r.desc} |`,
  )
  .join("\n");

writeFileSync(
  outputPath,
  `# 画面一覧\n\n| 画面名 | パス | 認証 | 概要 |\n|---|---|---|---|\n${rows}\n`,
  "utf-8",
);
console.log(`Generated: ${outputPath}`);
