import { flushPromises } from "@vue/test-utils";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { Race } from "../../../../shared/src/race-validation";
import { apiUrl, errorResponse, RACE_1_ID } from "../mocks/handlers";
import { server } from "../mocks/server";
import RaceListPage from "../pages/RaceListPage.vue";
import { makeAuth, mountWithApp } from "./helpers";

const race = (version: number, venue: string): Race => ({
  id: RACE_1_ID,
  date: "2026-09-06T00:00:00.000Z",
  name: "テストレース",
  venue,
  version,
  entries: [],
});

const mountRaceListPage = () =>
  mountWithApp(RaceListPage, {
    auth: makeAuth({ isAuthenticated: true }),
  });

describe("409 ハンドリング", () => {
  it("PATCH が 409 なら一覧を取り直してトーストを出す", async () => {
    let getCount = 0;
    server.use(
      http.get(apiUrl("/api/races"), () => {
        getCount++;
        // 1回目は更新前、onConflict の再取得では更新後を返す
        return HttpResponse.json(
          getCount === 1 ? [race(0, "東京")] : [race(1, "中山（先行更新）")],
        );
      }),
      http.patch(apiUrl(`/api/races/${RACE_1_ID}`), () =>
        errorResponse(409, "CONFLICT", "Conflict"),
      ),
    );

    const { wrapper, toast } = mountRaceListPage();
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("v0");
    });

    await wrapper.findAll("button")[1].trigger("click"); // 競馬場名を直す

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("v1");
      expect(wrapper.text()).toContain("中山（先行更新）");
    });

    expect(toast.items.value?.map((t) => [t.kind, t.message])).toEqual([
      ["error", "他の利用者が先に更新したため、最新の内容に更新しました。"],
    ]);
    // onConflict が渡っていなければ1回で終わり、成功トーストが出てしまう
    expect(getCount).toBe(2);
  });

  it("PATCH が成功すれば取り直して成功トーストを出す", async () => {
    let getCount = 0;
    server.use(
      http.get(apiUrl("/api/races"), () => {
        getCount++;
        return HttpResponse.json([race(getCount === 1 ? 0 : 1, "東京")]);
      }),
      http.patch(apiUrl(`/api/races/${RACE_1_ID}`), () =>
        HttpResponse.json(race(1, "東京競馬場")),
      ),
    );

    const { wrapper, toast } = mountRaceListPage();
    await vi.waitFor(() => expect(wrapper.text()).toContain("v0"));

    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();

    await vi.waitFor(() => {
      expect(toast.items.value?.map((t) => t.kind)).toEqual(["success"]);
    });
    expect(getCount).toBe(2);
  });
});
