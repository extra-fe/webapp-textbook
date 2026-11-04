import { expect, test } from "@playwright/test";

// PK は UUID（schema.prisma の @default(uuid())）
const RACE_1_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const RACE_1 = {
  id: RACE_1_ID,
  date: "2025-05-25T00:00:00.000Z",
  name: "日本ダービー",
  venue: "東京",
  entries: [],
  version: 0,
};

const RACE_1_WITH_ENTRIES = {
  ...RACE_1,
  entries: [
    {
      id: "b1c2d3e4-5f60-4a71-8b92-0c1d2e3f4a50",
      raceId: RACE_1_ID,
      frameNumber: 1,
      horseNumber: 1,
      horseName: "ディープインパクト",
      sex: "牡",
      age: "3",
      jockey: "武豊",
      trainer: "池江泰郎",
    },
  ],
};

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

test.describe("レース一覧画面", () => {
  test("空状態: 一覧が空でも画面が正常に表示されること", async ({ page }) => {
    await page.route("**/api/races", (route) => route.fulfill(json([])));

    await page.goto("/races");

    await expect(page.getByRole("region", { name: "処理結果" })).toBeVisible();
    await expect(
      page.getByText("レースを選ぶとここに詳細が出ます"),
    ).toBeVisible();
    await expect(page.getByLabel("レース名")).toBeVisible();
  });

  test("レース一覧が表示されること", async ({ page }) => {
    await page.route("**/api/races", (route) => route.fulfill(json([RACE_1])));

    await page.goto("/races");

    // 一覧の行は <ul><li> の中のボタン（3.3節）。表ではないので cell では引けない
    await expect(
      page.getByRole("button", { name: /日本ダービー/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /2025\/05\/25／東京／出走 0 頭/ }),
    ).toBeVisible();
  });

  test("新規登録フォームからレースを作成すると一覧に追加されること", async ({
    page,
  }) => {
    // onSubmit は POST の後に fetchRaces() で再取得する。GET を一度きりの
    // 固定応答にすると作成後も空のままなので、作成済みかどうかを持たせる。
    let created = false;
    await page.route("**/api/races", (route) => {
      if (route.request().method() === "POST") {
        created = true;
        return route.fulfill(json(RACE_1, 201));
      }
      return route.fulfill(json(created ? [RACE_1] : []));
    });

    await page.goto("/races");

    await page.getByLabel("開催日").fill("2025-05-25");
    await page.getByLabel("レース名").fill("日本ダービー");
    await page.getByLabel("競馬場").fill("東京");

    // 「レースを登録」では確定せず、3.8節の確認ダイアログが開く
    await page.getByRole("button", { name: "レースを登録" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "確定" }).click();

    await expect(
      page.getByRole("button", { name: /日本ダービー/ }),
    ).toBeVisible();
  });

  test("一覧の行をクリックするとレース詳細が表示されること", async ({
    page,
  }) => {
    await page.route("**/api/races", (route) => route.fulfill(json([RACE_1])));
    // 一覧と前方一致で重なるので、詳細を後から登録して優先させる
    await page.route(`**/api/races/${RACE_1_ID}`, (route) =>
      route.fulfill(json(RACE_1_WITH_ENTRIES)),
    );

    await page.goto("/races");
    await page.getByRole("button", { name: /日本ダービー/ }).click();

    const panel = page.getByRole("region", { name: "処理結果" });
    await expect(panel.getByRole("heading")).toContainText("日本ダービー");
    await expect(
      panel.getByText("1. ディープインパクト（武豊）"),
    ).toBeVisible();
  });

  test("一覧取得が失敗するとエラーメッセージが表示されること", async ({
    page,
  }) => {
    await page.route("**/api/races", (route) =>
      route.fulfill(json({ message: "Internal Server Error" }, 500)),
    );

    await page.goto("/races");

    // onMounted の catch が race.list.fetchError を入れる（3.3節）
    await expect(
      page.getByText("レース一覧の取得に失敗しました"),
    ).toBeVisible();
  });

  test("会場名を直すと成功トーストが出ること", async ({ page }) => {
    await page.route(`**/api/races/${RACE_1_ID}**`, (route) =>
      route.fulfill(json({ ...RACE_1, venue: "東京競馬場", version: 1 })),
    );
    await page.route("**/api/races", (route) => route.fulfill(json([RACE_1])));

    await page.goto("/races");
    await page.getByRole("button", { name: "会場名を直す" }).click();

    await expect(page.getByText("更新しました。")).toBeVisible();
  });
});
