import { expect, test } from "@playwright/test";

// playwright.config.ts の webServer.env で VITE_AUTH_ENABLED=false が設定されている。
// この状態では usePermissions（3.9節）がモックロールを参照するため、localStorage の
// "mockUserRoles" を上書きすることでロール別の表示制御を検証できる。
//
// Vite の環境変数は dev サーバー起動時に確定するためテストごとに変えられない。
// addInitScript なら 1 つの dev サーバーのままロールを差し替えられる。
const MOCK_ROLES_STORAGE_KEY = "mockUserRoles";

const asRole = async (
  page: import("@playwright/test").Page,
  roles: string,
): Promise<void> => {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [MOCK_ROLES_STORAGE_KEY, roles],
  );

  await page.route("**/api/races", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          name: "春の大賞",
          date: "2024-04-01T00:00:00.000Z",
          venue: "東京",
          entries: [],
          version: 0,
        },
      ]),
    }),
  );
};

test.describe("RBAC: ProtectedRoute のロール判定", () => {
  // RacesPage は requiredRoles に admin / operator / viewer を渡している。
  // バックエンドの RaceController の @Roles と揃えてある。
  for (const role of ["admin", "operator", "viewer"]) {
    test(`${role} はレース一覧を開けること`, async ({ page }) => {
      await asRole(page, role);

      await page.goto("/races");

      await expect(
        page.getByRole("button", { name: /春の大賞/ }),
      ).toBeVisible();
      await expect(page.getByText("403 Forbidden")).toBeHidden();
    });
  }

  test("要件を満たさないロールでは 403 Forbidden が表示されること", async ({
    page,
  }) => {
    await asRole(page, "guest");

    await page.goto("/races");

    await expect(page.getByText("403 Forbidden")).toBeVisible();
    await expect(page.getByRole("button", { name: /春の大賞/ })).toBeHidden();
  });

  test("複数ロールを持つ場合はいずれかが要件を満たせば開けること", async ({
    page,
  }) => {
    await asRole(page, "guest,viewer");

    await page.goto("/races");

    await expect(page.getByRole("button", { name: /春の大賞/ })).toBeVisible();
  });
});
