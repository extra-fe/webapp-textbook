import { expect, test, type Page } from "@playwright/test";

/**
 * 3.10節の離脱ガード。
 * 本書のアプリには画面内の遷移リンクがまだ無いので、アプリ内遷移は
 * ブラウザの「戻る」で起こす。
 */
const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** ホーム → レース一覧、と辿って「戻る」で離脱できる状態にする */
const gotoRacesViaHome = async (page: Page) => {
  await page.route("**/api/races", (route) => route.fulfill(json([])));
  await page.goto("/");
  await page.getByRole("link", { name: "レース一覧へ" }).click();
  await expect(page).toHaveURL(/\/races$/);
};

/**
 * cancelable な beforeunload を投げて defaultPrevented を読む。
 * ネイティブのダイアログを出さずに、リスナーの登録状態だけを判定できる。
 */
const beforeUnloadIsGuarded = (page: Page) =>
  page.evaluate(() => {
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });

test.describe("離脱ガード", () => {
  test("未入力なら「戻る」で確認が出ずに抜ける", async ({ page }) => {
    await gotoRacesViaHome(page);

    await page.goBack();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("入力があると「戻る」で遷移が止まり、確認が出る", async ({ page }) => {
    await gotoRacesViaHome(page);
    await page.getByLabel("レース名").fill("打ちかけ");

    await page.goBack();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(
      "このまま移動すると入力した内容は失われます",
    );
    // URL はブラウザの「戻る」で先に変わる。留まったかどうかは、
    // 確認に答えたあとの URL で見る（次のテスト）
  });

  test("「入力に戻る」を押すと留まり、入力も残る", async ({ page }) => {
    await gotoRacesViaHome(page);
    await page.getByLabel("レース名").fill("打ちかけ");

    await page.goBack();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "入力に戻る" }).click();

    await expect(page).toHaveURL(/\/races$/);
    await expect(page.getByLabel("レース名")).toHaveValue("打ちかけ");
  });

  test("「移動する」を押すと抜ける", async ({ page }) => {
    await gotoRacesViaHome(page);
    await page.getByLabel("レース名").fill("打ちかけ");

    await page.goBack();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "移動する" }).click();

    await expect(page).toHaveURL(/\/$/);
  });

  // 常時登録すると bfcache が効かなくなるので、dirty のあいだだけ付ける
  test("beforeunload は入力があるあいだだけ登録される", async ({ page }) => {
    await gotoRacesViaHome(page);
    expect(await beforeUnloadIsGuarded(page)).toBe(false);

    await page.getByLabel("レース名").fill("打ちかけ");
    expect(await beforeUnloadIsGuarded(page)).toBe(true);
  });

  test("送信に成功すると dirty が落ちて登録も外れる", async ({ page }) => {
    const race = {
      id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      date: "2025-05-25T00:00:00.000Z",
      name: "日本ダービー",
      venue: "東京",
      entries: [],
      version: 0,
    };
    let created = false;
    await page.route("**/api/races", (route) => {
      if (route.request().method() === "POST") {
        created = true;
        return route.fulfill(json(race, 201));
      }
      return route.fulfill(json(created ? [race] : []));
    });
    await page.goto("/races");

    await page.getByLabel("開催日").fill("2025-05-25");
    await page.getByLabel("レース名").fill("日本ダービー");
    await page.getByLabel("競馬場").fill("東京");
    expect(await beforeUnloadIsGuarded(page)).toBe(true);

    await page.getByRole("button", { name: "レースを登録" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "確定" }).click();

    await expect(
      page.getByRole("button", { name: /日本ダービー/ }),
    ).toBeVisible();
    // resetForm() で dirty が落ちるので、リスナーも外れる
    expect(await beforeUnloadIsGuarded(page)).toBe(false);
  });
});
