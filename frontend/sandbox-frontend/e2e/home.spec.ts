import { expect, test } from "@playwright/test";

test("トップページが表示されること", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "競馬レース管理" }),
  ).toBeVisible();
});

test("ホームから「レース一覧へ」でレース一覧に遷移できること", async ({
  page,
}) => {
  await page.route("**/api/races", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  await page.goto("/");
  await page.getByRole("link", { name: "レース一覧へ" }).click();

  await expect(page).toHaveURL("/races");
  // 一覧画面には見出しが無いので、3.8節の ResultPanel（aria-label 付きの
  // <section>）をロールで引く。
  await expect(page.getByRole("region", { name: "処理結果" })).toBeVisible();
});
