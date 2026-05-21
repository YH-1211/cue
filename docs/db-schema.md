# Cue データベース設計 (Phase 1 MVP)

## 概要

Supabase (PostgreSQL) を使用。
- 認証: Supabase Auth (auth.users)
- ストレージ: Supabase Storage (写真)
- 行レベルセキュリティ (RLS) で「本人だけ自分のデータが見える/編集できる」を保証

## テーブル一覧

| テーブル | 役割 |
|---------|------|
| `profiles` | ユーザープロフィール (auth.users を拡張) |
| `events` | イベント情報 (API/RSS/ユーザー投稿) |
| `tags` | タグマスタ (桜・ジャズ・現代アートなど) |
| `event_tags` | イベントとタグの紐付け |
| `user_interests` | ユーザーの興味タグ |
| `saved_events` | 「行きたい」登録 + 通知設定 |
| `attended_events` | 「行った」記録 (メモ・評価) |
| `attended_photos` | 行ったイベントの写真 |
| `push_subscriptions` | Web Push 購読情報 |

## ER 概要

```
auth.users
   └─ profiles (1:1)
        ├─ user_interests ──┐
        ├─ saved_events ────┤
        ├─ attended_events ─┤
        └─ push_subscriptions

events ──┬─ event_tags ──── tags ──┘
         ├─ saved_events
         └─ attended_events ── attended_photos
```

## カテゴリ enum

`art / music / theater / festival / food / seasonal / film / learning`
(アート・音楽・舞台・祭り・フード・季節・映像・学び)

## データソース enum

`api / rss / user`
- `api`: 公式APIから取得
- `rss`: 公式RSSから取得
- `user`: ユーザー投稿 (要承認)

## RLS の方針

- `profiles`: 自分のレコードのみ更新可。閲覧は全員可 (公開プロフィール)
- `events`: `approved = true` のものは全員閲覧可。未承認は投稿者本人のみ
- `tags`: 全員閲覧可。書き込みは管理者のみ (Phase 2)
- `event_tags`: events に追従
- `user_interests` / `saved_events` / `attended_events` / `attended_photos` / `push_subscriptions`: 本人のみ閲覧・編集
