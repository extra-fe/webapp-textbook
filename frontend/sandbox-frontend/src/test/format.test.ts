import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate } from "../lib/format";

/** UTC の 0:00 に保存されたレース開催日 */
const ISO = "2026-09-06T00:00:00.000Z";

/**
 * プロセスのタイムゾーンを差し替える。
 * vi.stubEnv が process.env.TZ を書き換え、Node は Date を作るたびに読み直す。
 */
const setTimeZone = (tz: string) => {
  vi.stubEnv("TZ", tz);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("formatDate", () => {
  // この1本が無いと、下の2本は「TZ が切り替わっていないだけ」でも通ってしまう。
  // 差し替えが本当に効いていることを先に確かめておく。
  it("TZ の差し替えが実際に効いている", () => {
    setTimeZone("Asia/Tokyo");
    expect(new Date(ISO).getHours()).toBe(9);

    setTimeZone("America/New_York");
    expect(new Date(ISO).getHours()).toBe(20); // 前日の20時
  });

  it("TZ を差し替えても同じ日付を返す", () => {
    const zones = [
      "Asia/Tokyo",
      "UTC",
      "Europe/London",
      "America/New_York",
      "America/Los_Angeles",
      "Pacific/Honolulu",
    ];
    const results = zones.map((tz) => {
      setTimeZone(tz);
      return formatDate(ISO);
    });

    // timeZone: "UTC" を渡しているので、どの TZ でも 1 種類しか出ない
    expect(new Set(results).size).toBe(1);
    // ロケールは環境任せなので表記は固定しない。指している日付だけを見る
    expect(results[0]).toMatch(/2026/);
    expect(results[0]).toMatch(/09/);
    expect(results[0]).toMatch(/06/);
  });

  it("timeZone を渡さない toLocaleDateString は UTC より西で前日になる", () => {
    setTimeZone("America/Los_Angeles");

    expect(new Date(ISO).toLocaleDateString("ja-JP")).toBe("2026/9/5"); // ← ずれる
    expect(formatDate(ISO)).toMatch(/06/); // formatDate はずれない
  });

  it("値が無いときは空文字を返す", () => {
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });
});
