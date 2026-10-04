# DB スキーマ定義書

> **自動生成ファイル** — `pnpm gen:db-schema` で再生成されます。直接編集しないでください。
> 生成元: `backend/sandbox-backend/prisma/schema.prisma`

---

## ER 図

```mermaid
erDiagram
    users {
        uuid                 id                       PK
        varchar              externalId                    "IdP の sub（Keycloak なら UUID）"
        varchar              provider                      "IdP 識別子"
        varchar              email
        varchar              name
        timestamptz          createdAt
        timestamptz          updatedAt
    }

    user_roles {
        uuid                 userId                   FK
        varchar              role
    }

    races {
        uuid                 id                       PK   "レースID"
        timestamptz          date                          "開催日（UTCで保存）"
        varchar              name                          "レース名"
        varchar              venue                         "競馬場"
        integer              version                       "楽観ロック用バージョン"
        timestamptz          createdAt                     "登録時刻"
        uuid                 createdBy                FK   "登録ユーザー（users.id）"
        timestamptz          updatedAt                     "最終更新時刻"
        uuid                 updatedBy                FK   "最終更新ユーザー（users.id）"
    }

    entries {
        uuid                 id                       PK   "出走馬ID"
        uuid                 raceId                   FK   "レースID（外部キー）"
        integer              frameNumber                   "枠番"
        integer              horseNumber                   "馬番"
        varchar              horseName                     "馬名"
        varchar              sex                           "性（例: 牡）"
        varchar              age                           "齢（例: 3）"
        double precision     weight                        "斤量（kg）"
        varchar              jockey                        "騎手"
        varchar              trainer                       "調教師"
        varchar              bodyWeight                    "例: 460(+4)"
        integer              oddsRank                      "単勝人気（例: 1）"
        double precision     odds                          "単勝オッズ（例: 2.5）"
        integer              rank                          "着順（例: 1）"
        varchar              time                          "タイム（例: 1:34.5）"
        varchar              margin                        "着差（例: クビ）"
        timestamptz          createdAt
        timestamptz          updatedAt
    }

    announcements {
        uuid                 id                       PK
        varchar              title
        varchar              body
        varchar              level                         "info / warning / error"
        timestamptz          startsAt
        timestamptz          endsAt
        timestamptz          createdAt
        timestamptz          updatedAt
    }

    user_roles }o--|| users : "user"
    races }o--|| users : "creator"
    races }o--|| users : "updater"
    entries }o--|| races : "race"
```

---

## テーブル定義

### `users` テーブル

| カラム名 | 論理名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|---|
| `id` | ユーザID | `uuid` | NO | `uuid()` | PK —  |
| `externalId` | 外部ID | `varchar` | NO | `—` | IdP の sub（Keycloak なら UUID） |
| `provider` | プロバイダ | `varchar` | NO | `"keycloak"` | IdP 識別子 |
| `email` | メールアドレス | `varchar` | YES | `—` |  |
| `name` | 氏名 | `varchar` | YES | `—` |  |
| `createdAt` | 登録日時 | `timestamptz` | NO | `now()` |  |
| `updatedAt` | 更新日時 | `timestamptz` | NO | `—` |  |

**制約・インデックス**

| 種別 | 対象カラム | 内容 |
|---|---|---|
| PRIMARY KEY | `id` | — |
| UNIQUE | `externalId` | — |

---

### `user_roles` テーブル

| カラム名 | 論理名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|---|
| `userId` | ユーザID | `uuid` | NO | `—` | FK → `users.id` —  |
| `role` | ロール | `varchar` | NO | `—` |  |

**制約・インデックス**

| 種別 | 対象カラム | 内容 |
|---|---|---|
| FOREIGN KEY | `userId` → `users`(`id`) | `ON DELETE CASCADE` |

---

### `races` テーブル

| カラム名 | 論理名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|---|
| `id` | レースID | `uuid` | NO | `uuid()` | PK — レースID |
| `date` | 開催日時 | `timestamptz` | NO | `—` | 開催日（UTCで保存） |
| `name` | レース名 | `varchar` | NO | `—` | レース名 |
| `venue` | 競馬場 | `varchar` | NO | `—` | 競馬場 |
| `version` | 楽観ロックバージョン | `integer` | NO | `0` | 楽観ロック用バージョン |
| `createdAt` | 登録日時 | `timestamptz` | NO | `now()` | 登録時刻 |
| `createdBy` | 登録者 | `uuid` | NO | `—` | FK → `users.id` — 登録ユーザー（users.id） |
| `updatedAt` | 更新日時 | `timestamptz` | NO | `—` | 最終更新時刻 |
| `updatedBy` | 更新者 | `uuid` | NO | `—` | FK → `users.id` — 最終更新ユーザー（users.id） |

**制約・インデックス**

| 種別 | 対象カラム | 内容 |
|---|---|---|
| PRIMARY KEY | `id` | — |
| FOREIGN KEY | `createdBy` → `users`(`id`) | `ON DELETE RESTRICT` |
| FOREIGN KEY | `updatedBy` → `users`(`id`) | `ON DELETE RESTRICT` |
| UNIQUE | (`date`, `name`, `venue`) | — |

---

### `entries` テーブル

| カラム名 | 論理名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|---|
| `id` | 出走馬ID | `uuid` | NO | `uuid()` | PK — 出走馬ID |
| `raceId` | レースID | `uuid` | NO | `—` | FK → `races.id` — レースID（外部キー） |
| `frameNumber` | 枠番 | `integer` | NO | `—` | 枠番 |
| `horseNumber` | 馬番 | `integer` | NO | `—` | 馬番 |
| `horseName` | 馬名 | `varchar` | NO | `—` | 馬名 |
| `sex` | 性別 | `varchar` | NO | `—` | 性（例: 牡） |
| `age` | 馬齢 | `varchar` | NO | `—` | 齢（例: 3） |
| `weight` | 斤量 | `double precision` | YES | `—` | 斤量（kg） |
| `jockey` | 騎手 | `varchar` | NO | `—` | 騎手 |
| `trainer` | 調教師 | `varchar` | NO | `—` | 調教師 |
| `bodyWeight` | 馬体重 | `varchar` | YES | `—` | 例: 460(+4) |
| `oddsRank` | 単勝人気 | `integer` | YES | `—` | 単勝人気（例: 1） |
| `odds` | 単勝オッズ | `double precision` | YES | `—` | 単勝オッズ（例: 2.5） |
| `rank` | 着順 | `integer` | YES | `—` | 着順（例: 1） |
| `time` | タイム | `varchar` | YES | `—` | タイム（例: 1:34.5） |
| `margin` | 着差 | `varchar` | YES | `—` | 着差（例: クビ） |
| `createdAt` | 登録日時 | `timestamptz` | NO | `now()` |  |
| `updatedAt` | 更新日時 | `timestamptz` | NO | `—` |  |

**制約・インデックス**

| 種別 | 対象カラム | 内容 |
|---|---|---|
| PRIMARY KEY | `id` | — |
| FOREIGN KEY | `raceId` → `races`(`id`) | `ON DELETE CASCADE` |
| UNIQUE | (`raceId`, `horseNumber`) | — |

---

### `announcements` テーブル

| カラム名 | 論理名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|---|
| `id` | お知らせID | `uuid` | NO | `uuid()` | PK —  |
| `title` | タイトル | `varchar` | NO | `—` |  |
| `body` | 本文 | `varchar` | NO | `—` |  |
| `level` | 重要度 | `varchar` | NO | `"info"` | info / warning / error |
| `startsAt` | 掲載開始日時 | `timestamptz` | NO | `—` |  |
| `endsAt` | 掲載終了日時 | `timestamptz` | NO | `—` |  |
| `createdAt` | 登録日時 | `timestamptz` | NO | `now()` |  |
| `updatedAt` | 更新日時 | `timestamptz` | NO | `—` |  |

**制約・インデックス**

| 種別 | 対象カラム | 内容 |
|---|---|---|
| PRIMARY KEY | `id` | — |

## リレーション

| 子テーブル | 親テーブル | カーディナリティ | 削除時 |
|---|---|---|---|
| `user_roles` | `users` | N : 1 | CASCADE (users 削除で user_roles も全削除) |
| `races` | `users` | N : 1 | CASCADE (users 削除で races も全削除) |
| `races` | `users` | N : 1 | CASCADE (users 削除で races も全削除) |
| `entries` | `races` | N : 1 | CASCADE (races 削除で entries も全削除) |

---

## 備考

- 日時カラムはすべて `timestamptz` (タイムゾーン付き) で UTC 保存。表示時はアプリ側で JST 変換する。
- 楽観ロックは `races.version` カラムで管理する。
- `races.createdBy` / `races.updatedBy` は `users.id` への外部キー。IdP の sub は `users.externalId` が保持する。