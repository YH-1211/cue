-- セキュリティ修正: profiles.points の自己改ざん防止
--
-- 問題:
--   profiles の UPDATE ポリシーは `using (auth.uid() = id)` のみで列制限がなく、
--   ログインユーザーが anon/publishable キー経由で
--     update profiles set points = 999999 where id = auth.uid();
--   を実行でき、ランクを詐称できてしまう。
--
-- 方針:
--   points は SECURITY DEFINER トリガー (award_points_on_report 等) だけが
--   書き込む列。クライアント(anon/authenticated ロール)からの UPDATE 権限を
--   列単位で剥奪する。RLS の行ポリシーは列を絞れないため列レベル GRANT で対応。
--   SECURITY DEFINER 関数は関数オーナー権限で動くため影響を受けない。
-- =========================================================

revoke update (points) on public.profiles from anon, authenticated;
