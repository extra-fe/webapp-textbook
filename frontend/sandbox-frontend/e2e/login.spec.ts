import { expect, test } from "@playwright/test";

// playwright.config.ts の webServer.env で VITE_AUTH_ENABLED=false が設定されている。
// このとき auth-adapter は mockAuth を選び、isAuthenticated は true になる。
// バックエンドの MockAuthGuard が AUTH_ENABLED=false でモックユーザーを詰めるのと
// 対称の挙動で、Keycloak SDK の初期化通信も走らない。
//
// ログイン画面そのものの描画（判定中／未認証）は LoginPage のユニットテストが
// 担当する。ここでは「認証を切ったモードで保護ルートが開けること」を固定する。

const stubRaceList = async (page: import("@playwright/test").Page) => {
  await page.route("**/api/races", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
};

test.describe("Auth 無効モード（VITE_AUTH_ENABLED=false）", () => {
  test("/login に直接アクセスすると認証済み扱いで /races へ送られること", async ({
    page,
  }) => {
    await stubRaceList(page);

    await page.goto("/login");

    await expect(page).toHaveURL("/races");
    await expect(page.getByRole("region", { name: "処理結果" })).toBeVisible();
  });

  test("自動遷移は replace なので「戻る」でヒストリーが増えないこと", async ({
    page,
  }) => {
    await stubRaceList(page);

    await page.goto("/login");
    await expect(page).toHaveURL("/races");

    const before = await page.evaluate(() => history.length);
    await page.goBack();
    const after = await page.evaluate(() => history.length);

    // push だと「戻る」のたびに 1 件増え続ける。replace なら変わらない。
    expect(after).toBe(before);
  });

  test("保護ルートに認証なしで直接アクセスできること", async ({ page }) => {
    await stubRaceList(page);

    await page.goto("/races");

    await expect(
      page.getByRole("button", { name: "レースを登録" }),
    ).toBeVisible();
  });
});
