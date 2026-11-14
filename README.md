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

## 動かす

PostgreSQL と Keycloak はコンテナで起動します。Docker Desktop と Node.js 24.x、
pnpm 11.x が必要です。

```powershell
# 1. PostgreSQL と Keycloak を起動する
docker compose up -d

# 2. バックエンド
cd backend/sandbox-backend
Copy-Item .env.example .env
pnpm install
pnpm prisma generate          # 生成物はコミットしていないので必須
pnpm prisma migrate deploy
pnpm db:seed
pnpm start:dev                # http://localhost:3000

# 3. フロントエンド（別のターミナルで）
cd frontend/sandbox-frontend
Copy-Item .env.example .env
pnpm install
pnpm dev                      # http://localhost:5173
```

**`pnpm prisma generate` を飛ばさないでください。** Prisma クライアントは
`src/generated/prisma/` に生成されるもので、リポジトリには含めていません。
これを実行せずに `pnpm test` や `pnpm build` を叩くと、型が見つからずまとめて落ちます。

`.env` も同じ理由で含めていません。`.env.example` をコピーすれば、ローカルで
動く値が入っています。ログインに使うテストユーザーは `keycloak/sandbox-realm.json`
に入っていて、Keycloak の起動時に取り込まれます。

テストは次のとおりです。バックエンドの `test:e2e` は実データベースを使うので、
コンテナを起動したうえで実行してください。

```powershell
cd backend/sandbox-backend
pnpm lint:ci ; pnpm test ; pnpm test:e2e

cd frontend/sandbox-frontend
pnpm lint:ci ; pnpm test ; pnpm test:e2e      # test:e2e は Playwright
```

## 節ごとのタグ

このリポジトリは**1節＝1コミット**で積んでいます。各節の終わりの状態にタグが付いているので、
読んでいる節の状態をそのまま取り出せます。

```powershell
git checkout v1-3.05   # 上巻3.5節の終わりの状態
git switch main        # 最新（上巻7.10節の終わり）に戻る
```

- `v1-` が上巻、`v2-` が下巻（2027年5月予定）です
- 節番号は2桁にそろえています。本文の「3.5節」はタグの `v1-3.05` にあたります
- `git tag -l 'v1-3.*'` で章ごとに絞れます
- **表のタグ名はコミットへのリンクです。** 押すと、その節で何を足したかが差分で読めます
- 新しく置くファイルが無い節（2.2・2.4・3.3・3.4・3.13・5.1・6.1・6.5・6.7・7.1）は、
  直前のコミットに同じタグを重ねて打っています

| タグ | 節 | |
|---|---|---|
| [`v1-1.01`](https://github.com/extra-fe/webapp-textbook/commit/86afef0cc50b3cdd3547970c15677f132a3667b8) | 1.1 | 何を作るかと、なぜこの組み合わせかを決める（Vue / NestJS / PostgreSQL） |
| [`v1-1.02`](https://github.com/extra-fe/webapp-textbook/commit/ce71ea2fb0b9c4f211aa989624218170c3f1592d) | 1.2 | 開発環境をコマンド1つで立ち上げる（Docker Compose） |
| [`v1-1.03`](https://github.com/extra-fe/webapp-textbook/commit/9ac5a43a7bc215021b4717b0197c93d4cf3136bf) | 1.3 | 誰が立てても同じ認証サーバーになるようにする（Keycloak） |
| [`v1-1.04`](https://github.com/extra-fe/webapp-textbook/commit/866c8c97ae80901d9668dc8c2e614322555a24c3) | 1.4 | 画面を足していけるフロントエンドの土台を作る（Vue） |
| [`v1-1.05`](https://github.com/extra-fe/webapp-textbook/commit/3b1752c73e881e6bf408f02c3e5891c2b389861f) | 1.5 | APIを足していけるバックエンドの土台を作る（NestJS / Prisma） |
| [`v1-1.06`](https://github.com/extra-fe/webapp-textbook/commit/d8e8e8013fc915a4938d388d2ab1178fa8d0c28d) | 1.6 | ログインを実装したうえで、開発用にスキップも可能にする（OIDC / PKCE） |
| [`v1-1.07`](https://github.com/extra-fe/webapp-textbook/commit/88544e64d3541447b402aee4a4cb72a5120f28da) | 1.7 | APIサーバーが生きているかを外から確かめる（ヘルスチェック） |
| [`v1-2.01`](https://github.com/extra-fe/webapp-textbook/commit/6657aaee8fe76652d66be3b5627f30299f728357) | 2.1 | テーブルを決めてマイグレーションで作る（Prisma マイグレーション） |
| [`v1-2.02`](https://github.com/extra-fe/webapp-textbook/commit/6657aaee8fe76652d66be3b5627f30299f728357) | 2.2 | 主キーにUUIDを選び、v4とv7を使い分ける |
| [`v1-2.03`](https://github.com/extra-fe/webapp-textbook/commit/abb8ec453afa603739d3e6cbfcb226d926e91ea1) | 2.3 | エンドポイントをSwaggerから叩けるようにする |
| [`v1-2.04`](https://github.com/extra-fe/webapp-textbook/commit/abb8ec453afa603739d3e6cbfcb226d926e91ea1) | 2.4 | 物理削除か論理削除かを決める |
| [`v1-2.05`](https://github.com/extra-fe/webapp-textbook/commit/57a8d9076da104f8b8c4d6ee234d5010e6bdaf0c) | 2.5 | フロントエンドからAPIを呼ぶ（axios / CORS） |
| [`v1-2.06`](https://github.com/extra-fe/webapp-textbook/commit/606c7966afdebf87497a52118f878a79169d6102) | 2.6 | APIの側でロールごとに操作できる範囲を分ける（RBAC） |
| [`v1-2.07`](https://github.com/extra-fe/webapp-textbook/commit/0e39e6cca08d6bd91f93546e7095c798c16e398d) | 2.7 | IdPを差し替えられるようにしておく |
| [`v1-3.01`](https://github.com/extra-fe/webapp-textbook/commit/d3a387eb0034d732a7c5cfdc394f1ace82fee7dd) | 3.1 | 書き間違いを人ではなく道具に見つけさせる（静的解析：ESLint / Biome） |
| [`v1-3.02`](https://github.com/extra-fe/webapp-textbook/commit/545807b46aba55a97b7acf64efb07f25ce53435d) | 3.2 | ボタンの二度押しで二重に登録させない（二重送信ガード） |
| [`v1-3.03`](https://github.com/extra-fe/webapp-textbook/commit/545807b46aba55a97b7acf64efb07f25ce53435d) | 3.3 | 画面で同じデータを2か所に保持しない（computed） |
| [`v1-3.04`](https://github.com/extra-fe/webapp-textbook/commit/545807b46aba55a97b7acf64efb07f25ce53435d) | 3.4 | 値を変えたのに画面が変わらないのを防ぐ（リアクティビティ） |
| [`v1-3.05`](https://github.com/extra-fe/webapp-textbook/commit/96940c8df22eef3b82ef18b562603b485b650596) | 3.5 | アクセストークンの取り直しを1回にまとめる（single-flight） |
| [`v1-3.06`](https://github.com/extra-fe/webapp-textbook/commit/cc42814f324db8af3e3d1c10217965566575886e) | 3.6 | 更新の衝突を検出し、最新を取り直す（楽観ロックの409） |
| [`v1-3.07`](https://github.com/extra-fe/webapp-textbook/commit/910283df031f2cea95c7f1cabf94b9e950504f06) | 3.7 | 認証を待たずに取れるデータから表示する（ローディング設計） |
| [`v1-3.08`](https://github.com/extra-fe/webapp-textbook/commit/e6cfb7438d0a3d749b6daba1b92f5c2b18d398e7) | 3.8 | 操作の確認を挟み、結果の置き場所を先に確保する（確認ダイアログ） |
| [`v1-3.09`](https://github.com/extra-fe/webapp-textbook/commit/c7c289a4f70c2e992dbf55ea6b7851789ca41993) | 3.9 | 画面を分け、「戻る」で詰まらない遷移にする（Vue Router） |
| [`v1-3.10`](https://github.com/extra-fe/webapp-textbook/commit/ae15485622d2af96a9bf565d844a5fd6744d1c5f) | 3.10 | 打ちかけの入力を失わせない（離脱ガード） |
| [`v1-3.11`](https://github.com/extra-fe/webapp-textbook/commit/4267219b15dc18e5580d02bdb673169261e97ddb) | 3.11 | デプロイせずにメンテナンス表示へ切り替える（メンテナンスモード） |
| [`v1-3.12`](https://github.com/extra-fe/webapp-textbook/commit/e912de6f5c3fd3b282ac0861a68833e0665cec5b) | 3.12 | エラーを取りこぼして白い画面にしない（エラーバウンダリ） |
| [`v1-3.13`](https://github.com/extra-fe/webapp-textbook/commit/e912de6f5c3fd3b282ac0861a68833e0665cec5b) | 3.13 | TanStack Query・VueUseを入れる段階かを見極める |
| [`v1-4.01`](https://github.com/extra-fe/webapp-textbook/commit/d398e40858e78ac20ff4aec5488527107970ba08) | 4.1 | 1件のリクエストを最後まで追えるようにする（OpenTelemetry / トレースID） |
| [`v1-4.02`](https://github.com/extra-fe/webapp-textbook/commit/df124cba9514302ab20273e6a252ebfeb67d4bb9) | 4.2 | ログをJSONで出してリクエストIDで追えるようにする（構造化ログ） |
| [`v1-4.03`](https://github.com/extra-fe/webapp-textbook/commit/0f810358c5b6ef77b7bcfa5f13dd1c6d1fe93912) | 4.3 | 弾かれたリクエストも取りこぼさずログに残す（インターセプター） |
| [`v1-4.04`](https://github.com/extra-fe/webapp-textbook/commit/12e7969fe7f5e386df1179c1a09e970a2edf16ad) | 4.4 | 同じ相手からの連打を一定回数で止める（レート制限） |
| [`v1-4.05`](https://github.com/extra-fe/webapp-textbook/commit/e73e3ab636d535b8ef8ef4e8360866d4d80cc5cd) | 4.5 | リクエストヘッダを書き換えてもレート制限を回避させない（trust proxy） |
| [`v1-4.06`](https://github.com/extra-fe/webapp-textbook/commit/c5b54f3a5879d2e7c6852653c7316612045c1cbf) | 4.6 | 停止時に処理中のリクエストを捨てない（グレースフルシャットダウン） |
| [`v1-4.07`](https://github.com/extra-fe/webapp-textbook/commit/93f4cabfd72d2c5f7a1c5114029a3378e2801b74) | 4.7 | DB接続を使い回し、つながらないときはやり直す（コネクションプール） |
| [`v1-4.08`](https://github.com/extra-fe/webapp-textbook/commit/31196f2f636a5d735a8ab402c892655397d670fe) | 4.8 | 応答しない外部APIを待ち続けない（タイムアウト） |
| [`v1-4.09`](https://github.com/extra-fe/webapp-textbook/commit/b3bc354b3e15866ecf62c43df9d5c528e9bdd820) | 4.9 | 設定が足りないまま起動させない（環境変数の検証） |
| [`v1-4.10`](https://github.com/extra-fe/webapp-textbook/commit/ad1ef36c02a396c5e1456a92d3324f116fe539ba) | 4.10 | 拾い損なった非同期エラーで黙って停止しない（unhandledRejection） |
| [`v1-4.11`](https://github.com/extra-fe/webapp-textbook/commit/bcc736b5774a2df305945aeed2ed5ef7ed1c4c64) | 4.11 | リトライしても二重に処理されないようにする（冪等性） |
| [`v1-4.12`](https://github.com/extra-fe/webapp-textbook/commit/b73fcb4f1269d3b8189622e488800220aad72276) | 4.12 | どのAPIも同じ形でエラーを返す（例外フィルタ） |
| [`v1-5.01`](https://github.com/extra-fe/webapp-textbook/commit/b73fcb4f1269d3b8189622e488800220aad72276) | 5.1 | 1つ破られても止まらないように層を重ねる（多層防御） |
| [`v1-5.02`](https://github.com/extra-fe/webapp-textbook/commit/255f98db429c750ec42fcf0791ed5b77bd6b6f14) | 5.2 | 安全な認可フローしか使えないことを確かめる（認可コードフロー / PKCE） |
| [`v1-5.03`](https://github.com/extra-fe/webapp-textbook/commit/13a9a1654079ce98f885ebeb0ad272c82b6d19d4) | 5.3 | 鍵が入れ替わっても落ちないようにする（JWKS / 鍵ローテーション） |
| [`v1-5.04`](https://github.com/extra-fe/webapp-textbook/commit/c607df6ed7bbd40e96047aa16ef61ca5980d8121) | 5.4 | 他人のIDを入れても見せない（IDOR） |
| [`v1-5.05`](https://github.com/extra-fe/webapp-textbook/commit/473336256a1d324431699cbca8c0aa6de3c97422) | 5.5 | 同じ利用者のロール照会が重なってもDBは1回だけ引く（ロールキャッシュ） |
| [`v1-5.06`](https://github.com/extra-fe/webapp-textbook/commit/3344a0cfaf116ed334b34a6d61e660b61e662188) | 5.6 | ブラウザ側の防御を効かせ、素性を隠す（Helmet / セキュリティヘッダ） |
| [`v1-5.07`](https://github.com/extra-fe/webapp-textbook/commit/9dff2168b22457cd311ca70578f26828bbce908e) | 5.7 | ガードとロールの付け忘れが起きない形にする（フェイルクローズ） |
| [`v1-6.01`](https://github.com/extra-fe/webapp-textbook/commit/9dff2168b22457cd311ca70578f26828bbce908e) | 6.1 | スキーマの変更を開発と本番で同じ形に残す（Prisma マイグレーション） |
| [`v1-6.02`](https://github.com/extra-fe/webapp-textbook/commit/cdcadcf02f4362ee7eb4fb8a73badcd5ed34a355) | 6.2 | 命名と型の規約を決め、機械で守らせる（スキーマ規約） |
| [`v1-6.03`](https://github.com/extra-fe/webapp-textbook/commit/81480b1f87ed488176a8761b98c18f2ee1b547a0) | 6.3 | 発行SQLを見えるようにしてN+1に気付く |
| [`v1-6.04`](https://github.com/extra-fe/webapp-textbook/commit/d780074f4b7f4e35512e74c5e43d7d2709956998) | 6.4 | 遅いクエリとデッドロックをログに残す |
| [`v1-6.05`](https://github.com/extra-fe/webapp-textbook/commit/d780074f4b7f4e35512e74c5e43d7d2709956998) | 6.5 | 同時更新で後の更新が負けることを確かめる（楽観ロック） |
| [`v1-6.06`](https://github.com/extra-fe/webapp-textbook/commit/6f86dfc1e431b5164152b49a9ebb36b510268993) | 6.6 | 日時をUTCで持ち、表示だけ現地時刻にする（タイムゾーン） |
| [`v1-6.07`](https://github.com/extra-fe/webapp-textbook/commit/6f86dfc1e431b5164152b49a9ebb36b510268993) | 6.7 | ブラウザが見たものを持ち帰る（開発者ツール / HAR） |
| [`v1-7.01`](https://github.com/extra-fe/webapp-textbook/commit/6f86dfc1e431b5164152b49a9ebb36b510268993) | 7.1 | どのテストで何を守るかを決める（テストピラミッド） |
| [`v1-7.02`](https://github.com/extra-fe/webapp-textbook/commit/509fcc442fbded86cc2c4cba9cc77b925c81d173) | 7.2 | バックエンドのロジックをDBなしで確かめる（ユニットテスト / Jest） |
| [`v1-7.03`](https://github.com/extra-fe/webapp-textbook/commit/f9f5549e4829fe1bc8fa9dfc3b60945d4b161e2b) | 7.3 | フロントエンドのテスト基盤を作る（Vitest / msw） |
| [`v1-7.04`](https://github.com/extra-fe/webapp-textbook/commit/1111519d246feab1293bb25eb590b8639ebeb7a4) | 7.4 | カバレッジを測り、下がったら落ちるようにする |
| [`v1-7.05`](https://github.com/extra-fe/webapp-textbook/commit/d3d56fe8fba0d5a8395e657bc34c23849aa1abc4) | 7.5 | 本物のDBを相手にAPIを通しで確かめる（統合テスト / supertest） |
| [`v1-7.06`](https://github.com/extra-fe/webapp-textbook/commit/7e1a3e6d0e80636ab1edfbf27733f43f11fe5d69) | 7.6 | ブラウザを動かして画面の流れを確かめる（Playwright） |
| [`v1-7.07`](https://github.com/extra-fe/webapp-textbook/commit/40d9873ba1de8a16557178cd77191b276b7e547c) | 7.7 | 認可の結果が画面に正しく出ることを確かめる（IDOR） |
| [`v1-7.08`](https://github.com/extra-fe/webapp-textbook/commit/71c38274e622477fb4767c45ba0a280ed86261f9) | 7.8 | 描き直す必要のない再描画を見つける |
| [`v1-7.09`](https://github.com/extra-fe/webapp-textbook/commit/628de2e233f17363cd8895701a2622d67a4ed8fb) | 7.9 | 負荷をかける土台を用意する（k6） |
| [`v1-7.10`](https://github.com/extra-fe/webapp-textbook/commit/08b9fff779e215e6977a25e4952c58e9894be9f1) | 7.10 | 並行更新で楽観ロックが効くことを測る（k6 / shared-iterations） |

## 正誤表

本文の誤りが見つかった場合は、このリポジトリの [Issues](../../issues) に記載します。

## ライセンス

このリポジトリのコードは [MIT License](LICENSE) です。自由に使えますが、**無保証**です。
書籍のサンプルとして書いたもので、本番環境での運用を想定した作りではありません。

本文（書籍）の著作権は著者に帰属します。ライセンスの対象はこのリポジトリのコードだけです。
