/**
 * Prisma スキーマ (schema.prisma) からテーブル定義書 & ER 図 (Mermaid) を生成するスクリプト。
 * 外部依存なし — schema.prisma をテキストパースして docs/db-schema.md を出力する。
 *
 * 使い方:
 *   pnpm gen:db-schema
 *
 * 出力先: docs/db-schema.md (プロジェクトルート)
 */

import * as fs from 'fs';
import * as path from 'path';

// ────────────────────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────────────────────

interface Field {
  name: string;
  prismaType: string; // String / Int / DateTime / ...
  isOptional: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  defaultValue: string | null; // autoincrement / now() / 0 / ...
  dbAnnotation: string | null; // @db.Uuid / @db.Timestamptz など
  relationFromFields: string[]; // FK 元カラム名
  relationToFields: string[]; // FK 先カラム名
  relationTarget: string | null; // 参照先モデル名 (仮想フィールドのみ)
  onDelete: string | null; // @relation(onDelete: ...)。未指定なら Prisma の既定
  fkTarget?: string; // 物理 FK カラムに転記した参照先モデル名
  fkToFields?: string[]; // 物理 FK カラムに転記した参照先カラム
  comment: string; // 行末コメント
  logicalName: string; // /// で書いたドキュメントコメント（論理名）
  dbName: string | null; // @map("...")。本プロジェクトでは使わない方針だが実態を出すため見る
}

interface Model {
  name: string;
  logicalName: string; // model の直前の ///（テーブルの論理名）
  dbName: string | null; // @@map("...")
  fields: Field[];
  uniqueConstraints: string[][]; // @@unique([a, b])
}

// ────────────────────────────────────────────────────────────────────────────
// パーサ
// ────────────────────────────────────────────────────────────────────────────

/**
 * pos の直前に連続している /// 行を 1 つにまとめて返す。
 * model の論理名はブロックの外側（model 行の上）に書くため、
 * 本文パースとは別にソースを遡って拾う必要がある。
 */
function docCommentsBefore(src: string, pos: number): string {
  const before = src.slice(0, pos).split(String.fromCharCode(10));
  const docs: string[] = [];
  for (let i = before.length - 2; i >= 0; i--) {
    const line = before[i].trim();
    if (!line.startsWith('///')) break;
    docs.unshift(line.slice(3).trim());
  }
  return docs.join(' ');
}

function parseSchema(src: string): Model[] {
  const models: Model[] = [];

  // model ブロックを抽出
  const modelRe = /^model\s+(\w+)\s*\{([^}]*)\}/gms;
  let mMatch: RegExpExecArray | null;

  while ((mMatch = modelRe.exec(src)) !== null) {
    const modelName = mMatch[1];
    const body = mMatch[2];

    // model 行の直前に連続する /// をテーブルの論理名として拾う
    const modelLogicalName = docCommentsBefore(src, mMatch.index);
    // /// は次に現れるフィールドの論理名になる
    let pendingDoc = '';

    let dbName: string | null = null;
    const uniqueConstraints: string[][] = [];
    const fields: Field[] = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('///')) {
        pendingDoc = line.slice(3).trim();
        continue;
      }
      if (!line || line.startsWith('//')) continue;

      // @@map
      const mapM = line.match(/^@@map\("([^"]+)"\)/);
      if (mapM) {
        dbName = mapM[1];
        continue;
      }

      // @@unique([a, b, ...])
      const uniqM = line.match(/^@@unique\(\[([^\]]+)\]/);
      if (uniqM) {
        uniqueConstraints.push(uniqM[1].split(',').map((s) => s.trim()));
        continue;
      }

      // @@index / @@id など (無視)
      if (line.startsWith('@@')) continue;

      // フィールド行
      const fieldM = line.match(/^(\w+)\s+(\S+)(.*?)(?:\/\/(.*))?$/);
      if (!fieldM) continue;

      const [, fieldName, typeRaw, attrs, inlineComment] = fieldM;
      const isOptional = typeRaw.endsWith('?');
      const isList = typeRaw.endsWith('[]');
      const prismaType = typeRaw.replace(/[?[\]]/g, '');

      // @id
      const isId = /\@id\b/.test(attrs);
      // @unique
      const isUnique = /\@unique\b/.test(attrs);

      // @default(...) — ネスト括弧 (autoincrement(), now()) に対応
      let defaultValue: string | null = null;
      const defStart = attrs.indexOf('@default(');
      if (defStart !== -1) {
        let depth = 0;
        let i = defStart + '@default('.length - 1;
        let end = -1;
        for (; i < attrs.length; i++) {
          if (attrs[i] === '(') depth++;
          else if (attrs[i] === ')') {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end !== -1) {
          defaultValue = attrs.slice(defStart + '@default('.length, end).trim();
        }
      }

      // @map("...") — フィールド単位の物理名。付いていなければ Prisma は
      // フィールド名をそのまま物理カラム名にする（camelCase のまま）。
      const colMapM = attrs.match(/(?:^|[^@])@map\("([^"]+)"\)/);

      // @db.<Type>
      const dbAnnM = attrs.match(/@db\.(\w+)/);
      const dbAnnotation: string | null = dbAnnM ? dbAnnM[1] : null;

      // @relation(fields: [...], references: [...])
      let onDelete: string | null = null;
      let relationFromFields: string[] = [];
      let relationToFields: string[] = [];
      const relM = attrs.match(/@relation\(([^)]+)\)/);
      if (relM) {
        const relBody = relM[1];
        const fromM = relBody.match(/fields:\s*\[([^\]]+)\]/);
        const toM = relBody.match(/references:\s*\[([^\]]+)\]/);
        const onDelM = relBody.match(/onDelete:\s*(\w+)/);
        if (onDelM) onDelete = onDelM[1];
        if (fromM) relationFromFields = fromM[1].split(',').map((s) => s.trim());
        if (toM) relationToFields = toM[1].split(',').map((s) => s.trim());
      }

      // Prisma スカラー型以外 = モデル参照 (仮想リレーションフィールド)
      const SCALAR_TYPES = new Set([
        'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal',
        'DateTime', 'Json', 'Bytes', 'Unsupported',
      ]);
      const isModelRef = !SCALAR_TYPES.has(prismaType);
      const relationTarget = isModelRef ? prismaType : null;

      fields.push({
        name: fieldName,
        prismaType,
        isOptional,
        isList,
        isId,
        isUnique,
        defaultValue,
        dbAnnotation,
        relationFromFields,
        relationToFields,
        relationTarget,
        onDelete,
        comment: (inlineComment ?? '').trim(),
        logicalName: pendingDoc,
        dbName: colMapM ? colMapM[1] : null,
      });
      pendingDoc = '';
    }

    models.push({
      name: modelName,
      logicalName: modelLogicalName,
      dbName,
      fields,
      uniqueConstraints,
    });
  }

  // 仮想リレーションフィールドの relationFromFields を物理カラムに転記する
  // 例: Entry.race (@relation fields:[raceId]) → Entry.raceId に fkTarget を付与
  for (const model of models) {
    for (const f of model.fields) {
      if (!f.relationTarget || !f.relationFromFields.length) continue;
      for (const fromCol of f.relationFromFields) {
        const physField = model.fields.find((x) => x.name === fromCol);
        if (physField) {
          physField.fkTarget = f.relationTarget;
          physField.fkToFields = f.relationToFields;
        }
      }
    }
  }

  return models;
}

// ────────────────────────────────────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────────────────────────────────────

function tbl(model: Model): string {
  return model.dbName ?? toSnakeCase(model.name);
}

/**
 * 物理カラム名。@map があればその値、無ければフィールド名そのまま。
 * カラム名は snake_case に変換しない（docs/db-naming の方針。Prisma の
 * コード上の名前と psql で見える名前を食い違わせないため）。
 */
function col(f: Field): string {
  return f.dbName ?? f.name;
}

/** フィールド名から物理カラム名を引く（@@unique / @relation の指定はフィールド名で書かれる）。 */
function colOf(model: Model, fieldName: string): string {
  const found = model.fields.find((x) => x.name === fieldName);
  return found ? col(found) : fieldName;
}

/**
 * 外部キーの削除時の動作。@relation(onDelete: ...) が無い場合は Prisma の既定が
 * 効く。**必須リレーションは Restrict、任意リレーションは SetNull** で、
 * Cascade ではない。ここを決め打ちにすると定義書と実際の DB がずれる。
 */
const REFERENTIAL_ACTION_SQL: Record<string, string> = {
  Cascade: 'CASCADE',
  Restrict: 'RESTRICT',
  NoAction: 'NO ACTION',
  SetNull: 'SET NULL',
  SetDefault: 'SET DEFAULT',
};

function onDeleteSql(relationField: Field): string {
  const action =
    relationField.onDelete ?? (relationField.isOptional ? 'SetNull' : 'Restrict');
  return REFERENTIAL_ACTION_SQL[action] ?? action.toUpperCase();
}

function toSnakeCase(s: string): string {
  return s
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

const PG_TYPE_MAP: Record<string, string> = {
  Int: 'integer',
  BigInt: 'bigint',
  Float: 'double precision',
  Decimal: 'numeric',
  String: 'varchar',
  Boolean: 'boolean',
  DateTime: 'timestamptz',
  Json: 'jsonb',
  Bytes: 'bytea',
};


/** Markdown の表のセルに入れる文字列。| はそのままだと列区切りになる。 */
function cell(text: string): string {
  return text.replace(/\|/g, '&#124;');
}

function pgType(f: Field): string {
  if (f.dbAnnotation === 'Uuid') return 'uuid';
  return PG_TYPE_MAP[f.prismaType] ?? f.prismaType.toLowerCase();
}

function fmtDefault(v: string | null): string {
  if (v === null) return '—';
  if (v === 'autoincrement()') return 'autoincrement';
  if (v === 'now()') return 'now()';
  return v;
}

// ────────────────────────────────────────────────────────────────────────────
// ER 図 (Mermaid erDiagram)
// ────────────────────────────────────────────────────────────────────────────

function buildErDiagram(models: Model[]): string {
  const lines: string[] = ['```mermaid', 'erDiagram'];

  for (const m of models) {
    lines.push(`    ${tbl(m)} {`);
    for (const f of m.fields) {
      // モデル参照フィールド (仮想) は DB カラムではないので除外
      if (f.relationTarget) continue;

      const type = pgType(f);
      const colName = col(f);
      const key = f.isId ? 'PK' : f.fkTarget ? 'FK' : '';
      const comment = f.comment ? `"${f.comment}"` : '';
      lines.push(`        ${type.padEnd(20)} ${colName.padEnd(24)} ${key.padEnd(4)} ${comment}`.trimEnd());
    }
    lines.push('    }');
    lines.push('');
  }

  // リレーション線 (FK 保持側から引く)
  for (const m of models) {
    for (const f of m.fields) {
      if (!f.relationFromFields.length || !f.relationTarget) continue;
      const parentModel = models.find((x) => x.name === f.relationTarget);
      if (!parentModel) continue;
      // entries }o--|| races : "race"
      lines.push(`    ${tbl(m)} }o--|| ${tbl(parentModel)} : "${f.name}"`);
    }
  }

  lines.push('```');
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// テーブル定義書
// ────────────────────────────────────────────────────────────────────────────

function buildTableDefs(models: Model[]): string {
  const sections: string[] = [];

  for (const m of models) {
    const lines: string[] = [`### \`${tbl(m)}\` テーブル`, ''];
    lines.push('| カラム名 | 論理名 | 型 | NULL | デフォルト | 説明 |');
    lines.push('|---|---|---|---|---|---|');

    for (const f of m.fields) {
      // モデル参照フィールド (仮想) は除外
      if (f.relationTarget) continue;

      const colName = col(f);
      const type = pgType(f);
      const nullable = f.isOptional ? 'YES' : 'NO';
      const def = fmtDefault(f.defaultValue);
      const logicalName = f.logicalName;
      const pkPrefix = f.isId ? 'PK — ' : '';
      const fkPrefix = f.fkTarget
        ? (() => {
            const parent = models.find((x) => x.name === f.fkTarget);
            const refTbl = parent ? tbl(parent) : (f.fkTarget ?? '');
            const refCols = (f.fkToFields ?? ['id'])
              .map((c) => (parent ? colOf(parent, c) : c))
              .join(', ');
            return `FK → \`${refTbl}.${refCols}\` — `;
          })()
        : '';
      const desc = pkPrefix + fkPrefix + f.comment;
      lines.push(`| \`${colName}\` | ${cell(logicalName)} | \`${type}\` | ${nullable} | \`${cell(def)}\` | ${cell(desc)} |`);
    }

    lines.push('');

    // 制約・インデックス
    const constraints: [string, string, string][] = [];

    const pkField = m.fields.find((f) => f.isId);
    if (pkField) constraints.push(['PRIMARY KEY', `\`${col(pkField)}\``, '—']);

    // FK: 仮想リレーションフィールドから取得
    for (const f of m.fields) {
      if (!f.relationTarget || !f.relationFromFields.length) continue;
      const parent = models.find((x) => x.name === f.relationTarget);
      if (!parent) continue;
      const fkCols = f.relationFromFields.map((c) => `\`${colOf(m, c)}\``).join(', ');
      const refCols = (f.relationToFields.length ? f.relationToFields : ['id'])
        .map((c) => `\`${colOf(parent, c)}\``)
        .join(', ');
      constraints.push(['FOREIGN KEY', `${fkCols} → \`${tbl(parent)}\`(${refCols})`, `\`ON DELETE ${onDeleteSql(f)}\``]);
    }

    for (const uq of m.uniqueConstraints) {
      const cols = uq.map((c) => `\`${colOf(m, c)}\``).join(', ');
      constraints.push(['UNIQUE', `(${cols})`, '—']);
    }

    for (const f of m.fields) {
      if (f.isUnique && !f.isId) {
        constraints.push(['UNIQUE', `\`${col(f)}\``, '—']);
      }
    }

    if (constraints.length) {
      lines.push('**制約・インデックス**', '');
      lines.push('| 種別 | 対象カラム | 内容 |');
      lines.push('|---|---|---|');
      for (const [kind, cols, note] of constraints) {
        lines.push(`| ${kind} | ${cols} | ${note} |`);
      }
      lines.push('');
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n---\n\n');
}

// ────────────────────────────────────────────────────────────────────────────
// リレーション一覧
// ────────────────────────────────────────────────────────────────────────────

function buildRelationTable(models: Model[]): string {
  const rows: string[] = [];

  for (const m of models) {
    for (const f of m.fields) {
      if (!f.relationFromFields.length || !f.relationTarget) continue;
      const parent = models.find((x) => x.name === f.relationTarget);
      if (!parent) continue;
      rows.push(`| \`${tbl(m)}\` | \`${tbl(parent)}\` | N : 1 | CASCADE (${tbl(parent)} 削除で ${tbl(m)} も全削除) |`);
    }
  }

  if (!rows.length) return '';

  return [
    '## リレーション',
    '',
    '| 子テーブル | 親テーブル | カーディナリティ | 削除時 |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────────────────────

function generate(): void {
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  const src = fs.readFileSync(schemaPath, 'utf-8');
  const models = parseSchema(src);

  if (!models.length) {
    console.error('モデルが見つかりません。schema.prisma のパスを確認してください。');
    process.exit(1);
  }

  const md = [
    '# DB スキーマ定義書',
    '',
    '> **自動生成ファイル** — `pnpm gen:db-schema` で再生成されます。直接編集しないでください。',
    `> 生成元: \`backend/sandbox-backend/prisma/schema.prisma\``,
    '',
    '---',
    '',
    '## ER 図',
    '',
    buildErDiagram(models),
    '',
    '---',
    '',
    '## テーブル定義',
    '',
    buildTableDefs(models),
    buildRelationTable(models),
    '',
    '---',
    '',
    '## 備考',
    '',
    '- 日時カラムはすべて `timestamptz` (タイムゾーン付き) で UTC 保存。表示時はアプリ側で JST 変換する。',
    '- 楽観ロックは `races.version` カラムで管理する。',
    '- `races.createdBy` / `races.updatedBy` は `users.id` への外部キー。IdP の sub は `users.externalId` が保持する。',
  ].join('\n');

  const outDir = path.resolve(__dirname, '../../../docs');
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'db-schema.md');
  fs.writeFileSync(outPath, md, 'utf-8');
  console.log(`✔ db-schema.md を出力しました: ${outPath}`);
  console.log(`  モデル数: ${models.length} (${models.map((m) => m.name).join(', ')})`);
}

generate();
