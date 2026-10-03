export const ROUTES = {
  HOME: {
    path: "/",
    name: "ホーム",
    auth: false,
    desc: "疎通確認用のトップページ。",
  },
  LOGIN: {
    path: "/login",
    name: "ログイン画面",
    auth: false,
    desc: "IdP のログイン画面へ送る。認証済みならレース一覧へリダイレクトする。",
  },
  RACES: {
    path: "/races",
    name: "レース一覧画面",
    auth: true,
    desc: "登録済みレースの一覧を表示し、新規レースの作成が行える。",
  },
  ERROR: {
    path: "/error",
    name: "エラーページ",
    auth: false,
    desc: "予期せぬエラーが発生した際に表示するエラーページ。",
  },
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey]["path"];
