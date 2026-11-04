import { beforeEach, describe, expect, it } from "vitest";
import {
  getSingleFlightToken,
  resetSingleFlightToken,
} from "../auth/single-flight-token";

/** 10ms かけてトークンを返す。呼ばれた回数も数える */
const makeSlowGetToken = () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    return `token-${calls}`;
  };
  return { fn, calls: () => calls };
};

// refreshPromise はモジュールスコープなのでテスト間で持ち越される
beforeEach(() => resetSingleFlightToken());

describe("getSingleFlightToken", () => {
  it("3並列で呼んでも取り直しは1回、全員が同じトークンを受け取る", async () => {
    const { fn, calls } = makeSlowGetToken();

    const [a, b, c] = await Promise.all([
      getSingleFlightToken(fn),
      getSingleFlightToken(fn),
      getSingleFlightToken(fn),
    ]);

    expect(calls()).toBe(1);
    expect([a, b, c]).toEqual(["token-1", "token-1", "token-1"]);
  });

  // finally でのクリアを落とすと、ここだけが expected 2, but got 1 で落ちる
  it("完了後の要求では取り直す", async () => {
    const { fn, calls } = makeSlowGetToken();

    await getSingleFlightToken(fn);
    const second = await getSingleFlightToken(fn);

    expect(calls()).toBe(2);
    expect(second).toBe("token-2");
  });

  it("取得に失敗しても次の要求で引き直せる", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return calls === 1
        ? Promise.reject(new Error("refresh failed"))
        : Promise.resolve("token-ok");
    };

    await expect(getSingleFlightToken(fn)).rejects.toThrow("refresh failed");
    await expect(getSingleFlightToken(fn)).resolves.toBe("token-ok");
    expect(calls).toBe(2);
  });
});
