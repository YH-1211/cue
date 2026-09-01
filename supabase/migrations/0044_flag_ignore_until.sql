-- =========================================================
-- 要確認フラグの「一時的な無視」(スヌーズ) 対応
-- =========================================================
-- 一部の公式サイトは bot からのアクセスを弾く (403) ため、実在していても
-- 毎日 dead_link として検出され続けてしまう。これらを resolved にしても
-- 翌日の cron で再検出されて open に戻るため、本当に見るべきフラグが埋もれる。
--
-- 対策として status='ignored' に「期限」と「理由」を持たせる:
--   - ignore_until を過ぎたら cron が自動で open に戻し、再確認を促す
--     (サイト側が復旧している / 本当に閉幕した 可能性があるため放置しない)
--   - ignore_note に「なぜ無視してよいか」を残す (例: botブロックだが実在確認済み)
--   - ignored_detail は無視した時点の detail。これと違う内容が検出されたら
--     状況が変わった (403 -> 404 等) とみなして cron が即 open に戻す。
-- =========================================================

alter table public.event_review_flags
  add column if not exists ignore_until    timestamptz,
  add column if not exists ignore_note     text,
  add column if not exists ignored_detail  text;

comment on column public.event_review_flags.ignore_until is
  'この日時までは再検出しても open に戻さない。過ぎたら cron が自動で open に戻す。';
comment on column public.event_review_flags.ignore_note is
  '無視してよい理由 (例: botブロックによる403だが公式ページの実在と日程を確認済み)';
comment on column public.event_review_flags.ignored_detail is
  '無視した時点の detail。異なる内容を検出したら状況変化とみなし即 open に戻す。';

-- 期限切れの ignored を拾いやすくする
create index if not exists event_review_flags_ignore_until_idx
  on public.event_review_flags(ignore_until)
  where status = 'ignored';
