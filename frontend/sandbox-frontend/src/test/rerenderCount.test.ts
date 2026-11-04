import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { apiUrl, RACE_1_ID } from "../mocks/handlers";
import { server } from "../mocks/server";
import RaceListPage from "../pages/RaceListPage.vue";
import { makeAuth, mountWithApp } from "./helpers";

/**
 * 再描画されたコンポーネント名を集める mixin。
 *
 * `$options.__name` には、SFC のファイル名からコンパイラが付けた名前
 * （RaceListPage・RaceCreateForm）が入る。実装に手を入れずに数えられる。
 */
const countUpdates = (into: string[]) => ({
  updated(this: { $options: { __name?: string } }) {
    into.push(this.$options.__name ?? "anonymous");
  },
});

const RACE_2_ID = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";

const race = (id: string, venue: string) => ({
  id,
  name: "春の大賞",
  date: "2024-05-01T00:00:00.000Z",
  venue,
  entries: [],
  version: 0,
});

/** 一覧のレスポンスを差し替える。server.use は後から呼んだほうが勝つ */
const useRaces = (...races: ReturnType<typeof race>[]) => {
  server.use(http.get(apiUrl("/api/races"), () => HttpResponse.json(races)));
};

const mountList = (updates: string[]) =>
  mountWithApp(RaceListPage, {
    auth: makeAuth({
      isAuthenticated: true,
      user: { name: "Test", roles: ["admin"] },
    }),
    options: { global: { mixins: [countUpdates(updates)] } },
  });

/** <script setup> の束縛はテストから vm 経由で読める */
const refetch = (wrapper: { vm: unknown }) =>
  (wrapper.vm as { fetchRaces: () => Promise<void> }).fetchRaces();

describe("不要な再描画の検出", () => {
  it("一覧が差し替わっても RaceCreateForm は巻き込まれない", async () => {
    useRaces(race(RACE_1_ID, "東京"));
    const updates: string[] = [];
    const { wrapper } = mountList(updates);

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("東京");
    });
    updates.length = 0; // マウント時の分は数えない

    // 一覧だけ差し替える（親の状態変化）
    useRaces(race(RACE_1_ID, "中山"));
    await refetch(wrapper);
    await nextTick();

    expect(wrapper.text()).toContain("中山");
    // 回数ではなく名前の配列を見る。落ちたときに「誰が描かれたか」が分かる
    expect(updates).toContain("RaceListPage");
    expect(updates).not.toContain("RaceCreateForm");
  });

  it("行が増えても RaceCreateForm は巻き込まれない", async () => {
    useRaces(race(RACE_1_ID, "東京"));
    const updates: string[] = [];
    const { wrapper } = mountList(updates);

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("東京");
    });
    updates.length = 0;

    useRaces(race(RACE_1_ID, "東京"), race(RACE_2_ID, "中山"));
    await refetch(wrapper);
    await nextTick();

    // 一覧は <ul><li>（3.3節）。表ではないので tbody tr では数えられない
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(updates).not.toContain("RaceCreateForm");
  });
});
