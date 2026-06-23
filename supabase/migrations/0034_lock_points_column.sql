-- セキュリティ修正: profiles.points の自己改ざん防止
--
-- 問題:
--   profiles の UPDATE ポリシーは `using (auth.uid() = id)` のみで列制限がなく、
--   さらに anon/authenticated にはテーブル全体の UPDATE 権限が付与されていたため、
--   ログインユーザーが publishable キー経由で
--     update profiles set points = 999999 where id = auth.uid();
--   を実行でき、ランクを詐称できてしまった。
--
-- 方針:
--   points は SECURITY DEFINER トリガー (award_points_on_report 等) だけが
--   書き込む列。クライアント(authenticated ロール)からの UPDATE 権限を列単位で
--   絞る。列単位 revoke はテーブル全体 GRANT に上書きされて効かないため、
--   いったんテーブル全体の UPDATE を剥奪し、points 以外の列だけ再付与する。
--   anon は RLS (auth.uid() = id) で元々更新できないので再付与しない。
--   SECURITY DEFINER 関数は関数オーナー権限で動くため影響を受けない。
-- =========================================================

revoke update on public.profiles from anon, authenticated;

grant update (
  display_name,
  avatar_url,
  interest_categories,
  notify_interest_weekly,
  notify_reminder_eve,
  notify_reminder_morning,
  notify_ticket,
  home_area,
  home_radius_km,
  notify_nearby_match,
  notify_quiet_hours_start,
  notify_quiet_hours_end,
  notify_quiet_hours_enabled,
  notify_interest_min_score,
  bio,
  onboarded_at
) on public.profiles to authenticated;
