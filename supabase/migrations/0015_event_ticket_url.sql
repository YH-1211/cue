-- #5 チケットリンク自動取得: events.ticket_url 列追加
-- ingest 時に official_url の HTML を簡易パースして発見したチケット販売ページの URL を保存する。
-- nullable text。NULL は「未取得」または「見つからなかった」を意味する。
alter table public.events
  add column if not exists ticket_url text;

comment on column public.events.ticket_url is
  '公式ページから自動検出したチケット販売/予約ページのURL。NULLは未取得もしくは検出なし。';
