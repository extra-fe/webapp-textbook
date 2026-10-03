/**
 * i18n キーの整合チェック。
 *
 * vue-i18n-extract は「1 ロケール = 1 ファイル」を前提にしていて、本リポジトリの
 * ように名前空間ごとにファイルを分けていると、他ファイルのキーを一律 missing と
 * 報告してしまう。そのため自前で突き合わせる。
 * （React 版も同じ理由で i18next-scanner にカスタム transform を書いていた。）
 *
 * 見るのは 2 点。
 *  - ソースで使っているのにロケールに無いキー（missing）→ 実行時に空表示になる
 *  - ロケールにあるのにソースで使っていないキー（unused）→ 消し忘れ
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const localesDir = join(root, "src/locales");
const srcDir = join(root, "src");

type Json = { [key: string]: Json | string };

/** ネストしたオブジェクトを "a.b.c" 形式のキー集合へ潰す。 */
const flatten = (obj: Json, prefix = ""): string[] =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flatten(value, path);
  });

/** ロケール配下の JSON をすべて読み、キー集合にする。 */
const readLocaleKeys = (locale: string): Set<string> => {
  const dir = join(localesDir, locale);
  const keys = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => flatten(JSON.parse(readFileSync(join(dir, f), "utf8"))));
  return new Set(keys);
};

/** src 配下の .ts / .vue を再帰的に集める（テストは対象外）。 */
const collectSources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "locales" || entry.name === "test"
        ? []
        : collectSources(full);
    }
    return /\.(ts|vue)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
      ? [full]
      : [];
  });

/**
 * t("...") / t('...') で参照しているキーを拾う。
 * テンプレート内の $t(...) も同じ形なので同時に拾える。
 * 変数を渡している呼び出し（t(key) など）は静的に追えないので対象外。
 *
 * 先読みの (?<![\w$]) が要点。これが無いと emit("cancel") や
 * createElement("a")、recordTelemetryEvent("web_vitals") のように
 * 「t( で終わる別の識別子」を拾ってしまう。
 */
const USED_KEY_RE = /(?<![\w$])\$?t\(\s*["']([A-Za-z][\w.]*)["']/g;

const collectUsedKeys = (files: string[]): Map<string, string[]> => {
  const used = new Map<string, string[]>();
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(USED_KEY_RE)) {
      const key = match[1];
      used.set(key, [...(used.get(key) ?? []), file.replace(root, ".")]);
    }
  }
  return used;
};

const locales = readdirSync(localesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const used = collectUsedKeys(collectSources(srcDir));
let failed = false;

// --- 名前空間の約束を検査する ---------------------------------------------
// この構成は「ファイル名 = 第1階層のキー」であることに依存している
// （race.json の中身が { "race": { ... } }）。崩れるとコードの
// t("race.list.title") が引けなくなるので、ここで固定する。
// あわせて i18n.ts が全ファイルを import しているかも見る。import 漏れは
// キーの突き合わせでは検出できず、実行時に空表示になる。
const i18nSource = readFileSync(join(srcDir, "i18n.ts"), "utf8");

for (const locale of locales) {
  const dir = join(localesDir, locale);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const ns = file.replace(/\.json$/, "");
    const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as Json;
    const topLevel = Object.keys(data);

    if (topLevel.length !== 1 || topLevel[0] !== ns) {
      failed = true;
      console.error(
        `\n[${locale}/${file}] 第1階層のキーがファイル名と一致しません。` +
          `期待: { "${ns}": ... } / 実際: { ${topLevel.map((k) => `"${k}"`).join(", ")} }`,
      );
    }

    if (!i18nSource.includes(`./locales/${locale}/${file}`)) {
      failed = true;
      console.error(
        `\n[${locale}/${file}] src/i18n.ts から import されていません。` +
          "追加したロケールファイルは i18n.ts の messages にも足してください。",
      );
    }
  }
}

// --- キーの突き合わせ -------------------------------------------------------
for (const locale of locales) {
  const defined = readLocaleKeys(locale);

  const missing = [...used.keys()].filter((k) => !defined.has(k));
  const unused = [...defined].filter((k) => !used.has(k));

  if (missing.length > 0) {
    failed = true;
    console.error(`\n[${locale}] ソースで使っているのに定義が無いキー:`);
    for (const key of missing.sort()) {
      console.error(`  ${key}  (${used.get(key)?.join(", ")})`);
    }
  }

  if (unused.length > 0) {
    failed = true;
    console.error(`\n[${locale}] 定義されているのに使われていないキー:`);
    for (const key of unused.sort()) console.error(`  ${key}`);
  }
}

if (failed) {
  console.error("\ni18n キーの整合チェックに失敗しました。");
  process.exit(1);
}

console.log(
  `i18n OK: ${locales.join(" / ")} で ${used.size} キーの参照がすべて定義されています。`,
);
