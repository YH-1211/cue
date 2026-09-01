-- 修正: notify_interest_upcoming / notify_interest_ticket / notify_via_line の
-- UPDATE 権限付与漏れ
--
-- 経緯:
--   0034 で profiles のテーブル全体 UPDATE を剥奪し、列単位 grant に変更した。
--   その後 0040 (notify_interest_upcoming, notify_interest_ticket) と
--   0041 (notify_via_line) で列を追加したが、列単位 grant への追加を忘れていた。
--   updatePreferences は6項目まとめて UPDATE するため、権限のない列が
--   1つでも混ざると更新全体が "permission denied for table profiles" で失敗し、
--   通知種別トグルがオフにできなくなっていた。

grant update (
  notify_interest_upcoming,
  notify_interest_ticket,
  notify_via_line
) on public.profiles to authenticated;
