-- =========================================================
-- 0046 の修正: 生成列 (effective_end) を比較から除外する
-- =========================================================
-- 0046 で「verified_at 以外に差分が無ければ updated_at を据え置く」トリガーを
-- 入れたが、実際には verified_at だけの更新でも updated_at が動いてしまっていた。
--
-- 原因は events.effective_end が生成列 (GENERATED ALWAYS ... STORED) であること。
-- BEFORE UPDATE トリガーの時点では NEW の生成列はまだ計算されておらず null、
-- 一方 OLD には保存済みの値が入っている。そのため to_jsonb(new) と to_jsonb(old)
-- は必ず差分ありと判定され、0046 の条件が常に真になっていた。
--
-- 比較から effective_end も除外する。
-- =========================================================

create or replace function public.touch_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- verified_at / updated_at に加え、生成列 effective_end も除いて比較する。
  -- (BEFORE UPDATE では NEW の生成列が未計算のため、含めると常に差分ありになる)
  if (to_jsonb(new) - 'verified_at' - 'updated_at' - 'effective_end')
     is distinct from
     (to_jsonb(old) - 'verified_at' - 'updated_at' - 'effective_end')
  then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

comment on function public.touch_events_updated_at() is
  'events 用の updated_at 打刻。verified_at のみの更新 (確認したが内容は変更なし) では updated_at を動かさない。生成列 effective_end は BEFORE UPDATE 時点で未計算のため比較から除外する。';
