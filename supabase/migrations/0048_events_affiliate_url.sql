-- 収益化(アフィリエイト)の器: events.affiliate_url 列追加
-- ASP (バリューコマース/A8.net/楽天等) 経由の成果報酬リンクを手動で登録する。
-- 値が入っている場合、詳細ページのチケットボタンは ticket_url ではなくこちらへ遷移し、
-- 広告表記 (ステマ規制対応) を併記する。NULL = アフィリリンク未設定 (通常の ticket_url を使う)。
alter table public.events
  add column if not exists affiliate_url text;

comment on column public.events.affiliate_url is
  'ASP経由のアフィリエイトリンク。設定時はチケットボタンの遷移先になり、広告表記が表示される。NULLは未設定。';
