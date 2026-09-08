-- =========================================================
-- 「最終確認日」を updated_at から分離する
-- =========================================================
-- stale_soon フラグは「開催が近いのに長期間見直されていない」イベントを
-- 目視確認に回すための呼び出しベルだが、これまで「最後に見直した日」を
-- updated_at (= 最後にデータを書き換えた日) で代用していた。
--
-- そのため「公式サイトを確認したが内容は正しかった」というケースを記録できず、
-- 中身は何も変えていないのに updated_at を空更新してフラグを黙らせる、という
-- 本来の意味とズレた運用になっていた。
--
-- verified_at を独立させることで:
--   - updated_at = データが変わった日 (本来の意味に戻る)
--   - verified_at = 公式ソースと突き合わせて正しいと確認した日
-- となり、「確認したが変更なし」を正しく記録できる。
-- =========================================================

alter table public.events
  add column if not exists verified_at timestamptz;

comment on column public.events.verified_at is
  '公式ソースと突き合わせて内容が正しいと最後に確認した日時。stale_soon の判定に使う。null なら未確認 (updated_at で代用)。';

-- stale_soon 判定は「近日開催 かつ 確認が古い」を毎日走査するため、
-- 未確認 (null) を含めて日時順に引けるようにしておく。
create index if not exists events_verified_at_idx
  on public.events(verified_at nulls first);
