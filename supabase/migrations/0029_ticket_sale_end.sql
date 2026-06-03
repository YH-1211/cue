-- チケット販売終了日時 + 「終了したイベント」判定用の実効終了列。
--
-- 1) ticket_sale_ends_at: チケットの販売終了日時 (null = 不明 / 未取得)。
--    取り込み時に公式ページの JSON-LD (offers.validThrough 等) から自動抽出する。
--    販売終了前の通知・販売終了メッセージ・詳細ページ表示に使う。
alter table public.events
  add column if not exists ticket_sale_ends_at timestamptz;

-- 2) effective_end: イベントの実効終了時刻。
--    ends_at があればそれ、無ければ starts_at。
--    複数日開催のイベントが「開始日を過ぎた瞬間に消える」のを防ぎ、
--    実際に終わるまで一覧に表示し続けるための判定列。
alter table public.events
  add column if not exists effective_end timestamptz
  generated always as (coalesce(ends_at, starts_at)) stored;

create index if not exists events_effective_end_idx
  on public.events(effective_end);

-- 販売終了通知のクエリ用 (saved_events × ticket_sale_ends_at)
create index if not exists events_ticket_sale_ends_idx
  on public.events(ticket_sale_ends_at)
  where ticket_sale_ends_at is not null;
