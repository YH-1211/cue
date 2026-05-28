-- ===========================================
-- 0013: award_points_on_event_approval の ON CONFLICT を partial index に揃える
--   - 既存の partial unique index は WHERE ref_event_id IS NOT NULL 付き
--   - ON CONFLICT (cols) で partial index を推論させるには WHERE 句必須
--   - これがないと 42P10 エラーで承認 UPDATE が失敗していた
-- ===========================================

create or replace function public.award_points_on_event_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved = true
     and (old.approved is distinct from true)
     and new.source_type = 'user'
     and new.submitted_by is not null
  then
    insert into public.point_transactions (user_id, delta, reason, ref_event_id)
    values (new.submitted_by, 10, 'event_approved', new.id)
    on conflict (user_id, reason, ref_event_id)
      where ref_event_id is not null
      do nothing;

    -- 実際に挿入された場合のみ profiles.points を加算
    if found then
      update public.profiles
        set points = points + 10
        where id = new.submitted_by;
    end if;
  end if;

  return new;
end;
$$;
