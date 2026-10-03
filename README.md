# webapp-textbook

技術同人誌『**Webアプリケーション実装からデプロイへの教科書**』のサンプルコードです。
本文の記述どおりに手を動かした結果を、そのまま置いています。

- 【上巻】ローカル環境を作って動かす（技術書典21・2026年11月23日）
- 【下巻】クラウドで本番運用する（2027年5月予定）

> このリポジトリの README だけは本文に登場しません。リポジトリを訪れた方への
> 案内として置いているものです。それ以外のファイルは、すべて本文のどこかで
> 作り方を説明しています。

## 題材

競馬レース管理の SPA です。レースと出走馬という親子関係のデータを扱い、
認証・認可・一覧・詳細・CRUD という Web アプリケーションに必要な要素を一通り含みます。

```
ブラウザ (Vue SPA)  ──HTTP/JSON──>  バックエンドAPI (NestJS)  ──>  PostgreSQL
        └─────OIDC/PKCE─────>  Keycloak (IdP)  <──JWKS──┘
```

## 構成

| | |
|---|---|
| フロントエンド | Vue 3 SPA（`frontend/sandbox-frontend`） |
| バックエンド | NestJS + Prisma（`backend/sandbox-backend`） |
| 共有 | バリデーションスキーマ（`shared`） |
| DB | PostgreSQL 18 |
| 認証 | Keycloak 26.2（OIDC / PKCE）。`IIdpProvider` 抽象で差し替え可能 |
| ランタイム | Node.js 24 / pnpm 11 |

ローカルの PostgreSQL と Keycloak は Docker Compose で起動します。

## 現在の範囲

**上巻の範囲だけが入っています。** 上巻は第1章から第8章までで、ローカル環境の構築から
手動でのクラウドデプロイまでを扱います。

`.github/workflows/` と `iac/` は**ありません**。CI/CD と Terraform による IaC は下巻の
範囲なので、下巻の刊行（2027年5月予定）に合わせて追加します。

## 使い方

本文を読みながら進めることを前提にしています。各節の末尾に「📌 この節のまとめ」として
確認方法（完了判定）が書かれているので、そこまで動けばその節は完了です。

動かすだけなら、おおよそ次の流れになります（詳細は本文の 1.2〜1.7）。

```bash
docker compose up -d                              # PostgreSQL と Keycloak
cd backend/sandbox-backend && pnpm install && pnpm prisma migrate dev && pnpm start
cd frontend/sandbox-frontend && pnpm install && pnpm dev
```

## 正誤表

本文の誤りが見つかった場合は、このリポジトリの [Issues](../../issues) に記載します。
