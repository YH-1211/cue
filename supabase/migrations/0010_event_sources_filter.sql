-- ===========================================
-- 0010: event_sources にキーワードフィルタを追加
--   - include_pattern: タイトルがこの正規表現にマッチするものだけ取り込む
--   - exclude_pattern: マッチしたものは除外（include より優先）
--   - 大文字小文字無視、null なら判定スキップ
-- ===========================================

alter table public.event_sources
  add column include_pattern text,
  add column exclude_pattern text;

comment on column public.event_sources.include_pattern is
  'タイトルがこの正規表現にマッチした行のみ取り込む。null なら全件取り込み。';
comment on column public.event_sources.exclude_pattern is
  'タイトルがこの正規表現にマッチした行は除外。include より優先。';

-- 音楽ナタリーは「ライブ/公演/フェス/ツアー/出演」など実イベント関連語を含むものだけ
-- 「リリース/MV/配信/特典/インタビュー」などのニュースは除外
update public.event_sources
set
  include_pattern = '(ライブ|公演|フェス|ツアー|出演|開催|ワンマン|来日|フェスティバル|EXPO)',
  exclude_pattern = '(リリース|配信開始|MV公開|特典|インタビュー|新曲|新譜|アルバム発売|ジャケ写|トレーラー)'
where name = '音楽ナタリー (試験)';
