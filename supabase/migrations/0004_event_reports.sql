-- =========================================================
-- 参加レポート機能 (Instagram-like)
-- =========================================================
-- attended_events を「レポート」として公開閲覧可にする
-- attended_photos も同様に公開閲覧可
-- Storage バケット event-reports を作成 (公開読み取り / 認証ユーザー書き込み)
-- =========================================================

-- ---------------------------------------------------------
-- attended_events を全員閲覧可に
-- ---------------------------------------------------------
create policy "attended events are public"
  on public.attended_events for select
  using (true);

-- ---------------------------------------------------------
-- attended_photos を全員閲覧可に
-- ---------------------------------------------------------
create policy "attended photos are public"
  on public.attended_photos for select
  using (true);

-- ---------------------------------------------------------
-- Storage バケット event-reports
-- 公開読み取り、認証ユーザーは自分の user_id フォルダのみ書き込み可
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('event-reports', 'event-reports', true)
  on conflict (id) do nothing;

-- バケットへのアップロードは認証ユーザーが <auth.uid()>/ 配下のみ
create policy "users upload own report photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 自分のオブジェクトを更新/削除可
create policy "users update own report photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'event-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own report photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 公開読み取り (バケットが public=true なので不要だが明示)
create policy "report photos are public"
  on storage.objects for select
  using (bucket_id = 'event-reports');
