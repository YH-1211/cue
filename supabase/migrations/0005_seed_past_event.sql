-- 過去開催のテストイベント (レポート投稿ボタンの動作確認用)
-- 削除/再投入可能にするため source_id='seed-past-001'

delete from public.events
 where source_type = 'user'
   and source_id = 'seed-past-001';

insert into public.events (
  title, description, starts_at, ends_at,
  venue_name, address, area, category,
  cover_image_url, official_url,
  ticket_sale_starts_at, source_type, source_id, approved
)
values (
  'アートフェア東京 2026',
  '日本最大級のアートフェア。国内外の有力ギャラリーが集結し、現代アートから古美術まで多彩な作品を展示・販売しました。',
  '2026-03-06 11:00+09', '2026-03-08 17:00+09',
  '東京国際フォーラム', '東京都千代田区丸の内3-5-1', '千代田', 'art',
  'https://images.unsplash.com/photo-1577720580479-7d839d829c73?w=800',
  'https://example.com/artfair-tokyo-2026', null,
  'user', 'seed-past-001', true
);
