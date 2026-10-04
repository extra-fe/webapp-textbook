/**
 * 各コントローラーの HTTP エンドポイントについて、認証と認可の指定漏れを検査する。
 *
 * ルール 1（認証）:
 *   - クラスレベルに @UseGuards(ConditionalAuthGuard があれば全メソッドが保護済みとみなす
 *   - そうでない場合、HTTP デコレーター (@Get/@Post 等) の直後に
 *     @UseGuards(ConditionalAuthGuard または @AllowAnonymous() が必要
 *
 * ルール 2（認可）:
 *   - RolesGuard を使っているハンドラーには @Roles(...) が必要。
 *     RolesGuard は @Roles が無いハンドラーを素通しするため、付け忘れても
 *     実行時には何も起きず、権限チェックの抜けがそのまま通ってしまう。
 *   - RolesGuard を使わず @UseGuards(ConditionalAuthGuard) だけのハンドラーは
 *     「認証さえ済んでいれば誰でも可」の意図とみなし、@Roles を要求しない。
 *   - @Roles はクラスレベルに付けても良い（全メソッドに効く）。
 *
 * 前提: @UseGuards/@AllowAnonymous()/@Roles は HTTP デコレーターの直後に
 * 連続したデコレーター行として記述すること。
 */
import * as fs from 'fs';
import * as path from 'path';

const HTTP_DECO_RE = /^\s*@(Get|Post|Put|Patch|Delete)\b/;
const DECORATOR_LINE_RE = /^\s*@/;
const ROLES_GUARD_RE = /@UseGuards\([^)]*RolesGuard/;

type Violation = { location: string; reason: 'auth' | 'roles' };

function checkFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  // クラス宣言行を探す
  const classLineIdx = lines.findIndex((l) =>
    /^\s*(export\s+)?class\s+\w/.test(l),
  );
  if (classLineIdx === -1) return violations;

  // クラスボディ開始 { までの行をクラスヘッダーとする
  let classBodyStart = classLineIdx;
  while (
    classBodyStart < lines.length &&
    !lines[classBodyStart].includes('{')
  ) {
    classBodyStart++;
  }

  const classHeader = lines.slice(0, classBodyStart + 1).join('\n');
  const classHasAuthGuard = classHeader.includes(
    '@UseGuards(ConditionalAuthGuard',
  );
  const classHasRolesGuard =
    classHasAuthGuard && ROLES_GUARD_RE.test(classHeader);
  const classHasRoles = classHeader.includes('@Roles(');

  const relPath = path.relative(process.cwd(), filePath);

  // メソッドごとにチェック
  for (let i = classLineIdx + 1; i < lines.length; i++) {
    if (!HTTP_DECO_RE.test(lines[i])) continue;

    // HTTP デコレーター以降、次の非デコレーター行（メソッド定義）まで収集
    const block: string[] = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
      if (!DECORATOR_LINE_RE.test(lines[j])) break;
      block.push(lines[j]);
    }

    const blockText = block.join('\n');
    const location = `${relPath}:${i + 1}`;

    const isAnonymous = blockText.includes('@AllowAnonymous()');
    const methodHasAuthGuard = blockText.includes(
      '@UseGuards(ConditionalAuthGuard',
    );

    if (!isAnonymous && !classHasAuthGuard && !methodHasAuthGuard) {
      violations.push({ location, reason: 'auth' });
      continue;
    }

    // 認可（@Roles）は RolesGuard を使っているハンドラーだけが対象
    const usesRolesGuard =
      classHasRolesGuard ||
      (methodHasAuthGuard && ROLES_GUARD_RE.test(blockText));
    if (usesRolesGuard && !classHasRoles && !blockText.includes('@Roles(')) {
      violations.push({ location, reason: 'roles' });
    }
  }

  return violations;
}

function findControllerFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findControllerFiles(fullPath));
    } else if (
      entry.name.endsWith('.controller.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

const srcDir = path.resolve(__dirname, '../src');
const allViolations: Violation[] = [];

for (const file of findControllerFiles(srcDir)) {
  allViolations.push(...checkFile(file));
}

if (allViolations.length > 0) {
  console.error('認証ガードチェック失敗:');

  const authViolations = allViolations.filter((v) => v.reason === 'auth');
  if (authViolations.length > 0) {
    console.error(
      '\n以下のエンドポイントに @UseGuards(ConditionalAuthGuard) または @AllowAnonymous() がありません:',
    );
    authViolations.forEach((v) => console.error(`  ${v.location}`));
    console.error(
      '認証不要なエンドポイントには HTTP デコレーターの直後に @AllowAnonymous() を付けてください。',
    );
  }

  const rolesViolations = allViolations.filter((v) => v.reason === 'roles');
  if (rolesViolations.length > 0) {
    console.error(
      '\n以下のエンドポイントは RolesGuard を使っているのに @Roles(...) がありません:',
    );
    rolesViolations.forEach((v) => console.error(`  ${v.location}`));
    console.error(
      'RolesGuard は @Roles が無いハンドラーを素通しします。許可するロールを明記するか、',
    );
    console.error(
      '「認証済みなら誰でも可」の意図なら @UseGuards から RolesGuard を外してください。',
    );
  }

  process.exit(1);
}

console.log('認証ガードチェック: OK');
