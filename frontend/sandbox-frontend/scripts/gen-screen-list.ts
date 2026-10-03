import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { ROUTES } from '../src/routes.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../../../docs/screen-list.md');

const rows = Object.values(ROUTES)
  .map((r) => `| ${r.name} | \`${r.path}\` | ${r.auth ? '✅' : '—'} | ${r.desc} |`)
  .join('\n');

const content = `# 画面一覧

> このファイルは \`cd frontend/sandbox-frontend && pnpm gen:screen-list\` により自動生成されます。直接編集しないでください。

| 画面名 | パス | 認証 | 概要 |
|--------|------|------|------|
${rows}
`;

writeFileSync(outputPath, content, 'utf-8');
console.log(`Generated: ${outputPath}`);
