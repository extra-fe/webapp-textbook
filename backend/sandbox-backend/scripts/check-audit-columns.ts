/**
 * schema.prisma のスキーマ規約をチェックする。
 *
 * ルール 1（監査カラム）:
 *   - 各モデルに createdAt / updatedAt が存在すること。
 *   - 結合テーブル（@@id([...]) を持つモデル）は対象外。
 *
 * ルール 2（日時型）:
 *   - すべての DateTime フィールドに @db.Timestamptz(3) が付いていること。
 *     付け忘れると PostgreSQL の timestamp without time zone になり、
 *     タイムゾーン情報が失われる（本文 6.6 節）。
 *   - こちらは結合テーブルも対象にする。
 */
import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const src = fs.readFileSync(schemaPath, 'utf-8');

// model ブロックを抽出
const modelRegex = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
const violations: string[] = [];

let match: RegExpExecArray | null;
while ((match = modelRegex.exec(src)) !== null) {
  const modelName = match[1];
  const body = match[2];

  // 結合テーブル（複合 PK @@id([...])）は監査カラムの対象外
  if (!/@@id\(\[/.test(body)) {
    const missingColumns: string[] = [];
    if (!/\bcreatedAt\b/.test(body)) missingColumns.push('createdAt');
    if (!/\bupdatedAt\b/.test(body)) missingColumns.push('updatedAt');

    if (missingColumns.length > 0) {
      violations.push(
        `  model ${modelName}: ${missingColumns.join(', ')} が不足しています`,
      );
    }
  }

  // DateTime は必ず timestamptz にする（本文 6.6 節）。結合テーブルも対象。
  for (const line of body.split('\n')) {
    const field = /^\s*(\w+)\s+DateTime\b/.exec(line);
    if (field && !/@db\.Timestamptz\(3\)/.test(line)) {
      violations.push(
        `  model ${modelName}.${field[1]}: DateTime に @db.Timestamptz(3) がありません`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error('スキーマ規約チェック失敗:');
  violations.forEach((v) => console.error(v));
  console.error(
    '\n新規テーブルには createdAt DateTime @default(now()) @db.Timestamptz(3) と' +
      ' updatedAt DateTime @updatedAt @db.Timestamptz(3) を追加してください。',
  );
  console.error(
    'DateTime フィールドには必ず @db.Timestamptz(3) を付けてください。' +
      '付けないと timestamp without time zone になり TZ 情報が失われます。',
  );
  process.exit(1);
}

console.log('スキーマ規約チェック: OK');
