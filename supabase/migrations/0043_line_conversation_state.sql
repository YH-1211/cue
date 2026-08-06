-- =========================================================
-- LINE bot の会話文脈 (直前の絞り込み条件) を短時間だけ保持する。
-- 「その中で近いのは?」「他には?」のような続き会話で、
-- 前ターンの window/category/area/excludeCategory を引き継ぐために使う。
-- line_user_id 単位で最新1件のみ保持 (上書き)。読み書きは service role のみ。
-- =========================================================

create table if not exists public.line_conversation_state (
  line_user_id     text primary key,
  window_label     text,
  window_start     timestamptz,
  window_end       timestamptz,
  category_label   text,
  category_values  text[],
  area_label       text,
  area_value       text,
  exclude_label    text,
  exclude_values   text[],
  updated_at       timestamptz not null default now()
);

comment on table public.line_conversation_state is
  'LINE bot の直前の絞り込み条件 (会話文脈)。updated_at から一定時間 (アプリ側でTTL判定) 経過したら無視する。';

alter table public.line_conversation_state enable row level security;
-- 閲覧・更新はRLSで一切許可しない (webhook は service role 経由で読み書きする)。
