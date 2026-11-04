/**
 * IDOR（Insecure Direct Object Reference）E2E テスト
 *
 * 検証スコープ:
 * 1. 水平的権限昇格 — 任意の UUID のレースを詳細表示できること（設計上全員参照可能）
 * 2. FORBIDDEN (403) ハンドリング — 権限不足時に UI が適切なエラーメッセージを表示すること
 * 3. UNAUTHORIZED (401) ハンドリング — 認証切れ時に UI が適切なエラーメッセージを表示すること
 *
 * バックエンドの自己参照 IDOR 対策（PUT /api/admin/users/:id/roles で 403）は
 * AdminUsersService のユニットテスト（5.4節）でカバー済み。フロントエンドに
 * 管理者ユーザー画面が無いため、E2E はレース画面を対象にする。
 */
import { expect, test } from "@playwright/test";

const RACE_A = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  date: "2025-05-25T00:00:00.000Z",
  name: "日本ダービー",
  venue: "東京",
  entries: [],
  version: 0,
  createdBy: "user-a",
};

const RACE_B = {
  ...RACE_A,
  id: "bbbbbbbb-0000-0000-0000-000000000002",
  name: "有馬記念",
  venue: "中山",
  createdBy: "user-b",
};

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** 4.13節の統一エラーフォーマットで返す */
const apiError = (status: number, code: string, message: string) =>
  json({ statusCode: status, code, message, requestId: "req-e2e" }, status);

test.describe("IDOR: 水平的権限昇格", () => {
  test("他ユーザー作成のレース詳細を参照できること（設計上全員参照可能）", async ({
    page,
  }) => {
    // 一覧は user-a 作成のレースのみ
    await page.route("**/api/races", (route) => route.fulfill(json([RACE_A])));
    // 詳細取得は user-b 作成のレースを返す（他ユーザーのリソース）
    await page.route(`**/api/races/${RACE_A.id}`, (route) =>
      route.fulfill(json({ ...RACE_B, id: RACE_A.id })),
    );

    await page.goto("/races");
    await page.getByRole("button", { name: /日本ダービー/ }).click();

    // createdBy が異なっても 200 で返り、詳細が表示される（意図した動作）
    const panel = page.getByRole("region", { name: "処理結果" });
    await expect(panel.getByRole("heading")).toContainText("有馬記念");
  });

  test("別の UUID のリソースへのアクセスも設計上は許可されること", async ({
    page,
  }) => {
    await page.route("**/api/races", (route) =>
      route.fulfill(json([RACE_A, RACE_B])),
    );
    await page.route(`**/api/races/${RACE_B.id}`, (route) =>
      route.fulfill(json(RACE_B)),
    );

    await page.goto("/races");
    await expect(
      page.getByRole("button", { name: /日本ダービー/ }),
    ).toBeVisible();

    // 2件目（他ユーザー作成）の行を開く
    await page.getByRole("button", { name: /有馬記念/ }).click();

    const panel = page.getByRole("region", { name: "処理結果" });
    await expect(panel.getByRole("heading")).toContainText("有馬記念");
  });
});

test.describe("IDOR: FORBIDDEN (403) ハンドリング", () => {
  test("詳細取得が 403 なら権限不足のメッセージが表示されること", async ({
    page,
  }) => {
    await page.route("**/api/races", (route) => route.fulfill(json([RACE_A])));
    await page.route("**/api/races/*", (route) =>
      route.fulfill(
        apiError(403, "FORBIDDEN", "この操作を行う権限がありません"),
      ),
    );

    await page.goto("/races");
    await page.getByRole("button", { name: /日本ダービー/ }).click();

    await expect(
      page.getByText("この操作を行う権限がありません。"),
    ).toBeVisible();
    // 一覧は生きたまま。エラーページへ飛んでいないこと
    await expect(page).toHaveURL("/races");
  });

  test("会場名の更新が 403 なら権限不足のメッセージが表示されること", async ({
    page,
  }) => {
    await page.route("**/api/races", (route) => route.fulfill(json([RACE_A])));
    await page.route(`**/api/races/${RACE_A.id}**`, (route) =>
      route.fulfill(
        apiError(403, "FORBIDDEN", "operator または admin ロールが必要です"),
      ),
    );

    await page.goto("/races");
    await page.getByRole("button", { name: "会場名を直す" }).click();

    await expect(
      page.getByText("この操作を行う権限がありません。"),
    ).toBeVisible();
  });

  test("レース作成が 403 なら権限不足のメッセージが表示されること", async ({
    page,
  }) => {
    await page.route("**/api/races", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill(
          apiError(403, "FORBIDDEN", "operator または admin ロールが必要です"),
        );
      }
      return route.fulfill(json([]));
    });

    await page.goto("/races");
    await page.getByLabel("開催日").fill("2025-05-25");
    await page.getByLabel("レース名").fill("日本ダービー");
    await page.getByLabel("競馬場").fill("東京");
    await page.getByRole("button", { name: "レースを登録" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "確定" }).click();

    await expect(
      page.getByText("この操作を行う権限がありません。"),
    ).toBeVisible();
    // 離脱確認ダイアログ（3.10節）が代わりに開いていないこと
    await expect(page.getByText("入力内容が保存されていません")).toBeHidden();
  });
});

test.describe("IDOR: UNAUTHORIZED (401) ハンドリング", () => {
  test("詳細取得が 401 なら再ログインを促すメッセージが表示されること", async ({
    page,
  }) => {
    await page.route("**/api/races", (route) => route.fulfill(json([RACE_A])));
    await page.route("**/api/races/*", (route) =>
      route.fulfill(apiError(401, "UNAUTHORIZED", "Unauthorized")),
    );

    await page.goto("/races");
    await page.getByRole("button", { name: /日本ダービー/ }).click();

    await expect(
      page.getByText("認証が必要です。再度ログインしてください。"),
    ).toBeVisible();
  });

  test("一覧取得が 401 のときは一覧用の固定メッセージが出ること", async ({
    page,
  }) => {
    await page.route("**/api/races", (route) =>
      route.fulfill(apiError(401, "UNAUTHORIZED", "Unauthorized")),
    );

    await page.goto("/races");

    // 初回ロードの失敗は onMounted の catch が拾い、ステータスに関係なく
    // race.list.fetchError を出す（3.3節）。トーストではなく画面上の文字列。
    await expect(
      page.getByText("レース一覧の取得に失敗しました"),
    ).toBeVisible();
  });
});
