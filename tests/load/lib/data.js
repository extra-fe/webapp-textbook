// POST /api/races 用のテストデータ生成。
//
// race.name を "LOADTEST-<実行ID>-<VU>-<iter>" 形式にしておくと、
//   DELETE FROM races WHERE name LIKE 'LOADTEST-%';
// で後片付けが一括でできる。

// 実行ごとにユニークな ID。この run のレコードだけ消すこともできる
export const runId = __ENV.RUN_ID || `${Date.now()}`;

/**
 * vu と iter を名前に入れるのは、2.1節で入れた @@unique([date, name, venue])
 * に引っかからないようにするため。同じ名前で並列に登録すると、競合ではなく
 * 一意制約違反の 409 が混ざり、測りたいものが分からなくなる。
 */
export function buildRacePayload(vu, iter) {
  return {
    date: new Date().toISOString(),
    name: `LOADTEST-${runId}-${vu}-${iter}`,
    venue: '京都',
    entries: [
      buildEntry(1, 1, 'ホクトベガ'),
      buildEntry(2, 2, 'サクラチヨノオー'),
      buildEntry(3, 3, 'メジロマックイーン'),
    ],
  };
}

export function buildEntry(frameNumber, horseNumber, horseName) {
  return {
    frameNumber,
    horseNumber,
    horseName,
    sex: '牡',
    age: '4',
    weight: 55.0,
    jockey: '加藤和宏',
    trainer: '中野隆良',
  };
}
