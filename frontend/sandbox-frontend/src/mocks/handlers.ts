import { HttpResponse, http } from "msw";
import type { Race } from "../../../../shared/src/race-validation";

/**
 * useApiCaller が組み立てるのと同じ絶対 URL を作る。
 *
 * msw は相対パスを location.href 基準で解決するため、VITE_API_BASE_URL が
 * jsdom のオリジンと違うとマッチしない。実装と同じ規則で組み立てておけば、
 * ベースURLを変えてもハンドラーを直さずに済む。
 */
export const apiUrl = (path: string): string =>
  `${import.meta.env.VITE_API_BASE_URL}${path}`;

/** 4.12節の統一エラーフォーマットを返す。server.use() の定型文を共通化する */
export const errorResponse = (
  status: number,
  code: string,
  message: string,
  requestId = "req-mock",
) =>
  HttpResponse.json(
    { statusCode: status, code, message, requestId, timestamp: "" },
    { status },
  );

/** PK は UUID（schema.prisma の @default(uuid())）。テストから名指しできるよう固定する */
export const RACE_1_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
export const CREATED_RACE_ID = "11111111-2222-4333-8444-555555555555";

export const sampleRaces: Race[] = [
  {
    id: RACE_1_ID,
    date: "2026-09-06T00:00:00.000Z",
    name: "テストレース",
    venue: "東京",
    version: 0,
    entries: [],
  },
];

export const handlers = [
  http.get(apiUrl("/api/races"), () => HttpResponse.json(sampleRaces)),

  http.get(apiUrl(`/api/races/${RACE_1_ID}`), () =>
    HttpResponse.json(sampleRaces[0]),
  ),

  http.post(apiUrl("/api/races"), async ({ request }) => {
    const body = (await request.json()) as Partial<Race>;
    return HttpResponse.json(
      { entries: [], version: 0, ...body, id: CREATED_RACE_ID },
      { status: 201 },
    );
  }),

  http.patch(apiUrl(`/api/races/${RACE_1_ID}`), async ({ request }) => {
    const body = (await request.json()) as Partial<Race>;
    return HttpResponse.json({ ...sampleRaces[0], ...body, version: 1 });
  }),

  http.get(apiUrl("/api/guest/announcements"), () => HttpResponse.json([])),
];
