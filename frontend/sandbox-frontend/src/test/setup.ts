import { enableAutoUnmount } from "@vue/test-utils";
import { afterAll, afterEach, beforeAll } from "vitest";
import "../i18n";
import { server } from "../mocks/server";

// attachTo: document.body でマウントしたコンポーネントを毎テスト後に片付ける。
// 残すと次のテストの document.activeElement などに影響する。
enableAutoUnmount(afterEach);

// ネットワーク層でモックする。ハンドラーが定義されていないリクエストは
// 「テストが意図しない通信をしている」サインなのでエラーにする。
// msw 3 で onUnhandledRequest から onUnhandledFrame に改名された
// （WebSocket 接続も対象になったため）。
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
