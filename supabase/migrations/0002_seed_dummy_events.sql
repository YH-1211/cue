-- Cue ダミーイベントデータ (動作確認用)
-- 実行先: Supabase SQL Editor
-- 削除/再投入したい時は冪等になるよう source_type='user' + source_id='seed-...' で識別

-- =========================================================
-- まず既存の seed データを削除 (再実行可能にするため)
-- =========================================================
delete from public.events
 where source_type = 'user'
   and source_id like 'seed-%';

-- =========================================================
-- ダミーイベント (12件、東京都内、各カテゴリを網羅)
-- starts_at は 2026-05-21 (今日) 以降の未来日付
-- =========================================================
with inserted as (
  insert into public.events (
    title, description, starts_at, ends_at,
    venue_name, address, area, category,
    cover_image_url, official_url,
    ticket_sale_starts_at, source_type, source_id, approved
  )
  values
    (
      '夜桜ライトアップ 2026 - 千鳥ヶ淵',
      '千鳥ヶ淵緑道の夜桜ライトアップ。約260本のソメイヨシノが幻想的に浮かび上がります。',
      '2026-04-01 18:00+09', '2026-04-10 22:00+09',
      '千鳥ヶ淵緑道', '東京都千代田区三番町2', '千代田', 'seasonal',
      'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800',
      'https://example.com/chidorigafuchi', null,
      'user', 'seed-001', true
    ),
    (
      '隅田川花火大会 2026',
      '東京の夏の風物詩。約2万発の花火が夜空を彩ります。',
      '2026-07-25 19:00+09', '2026-07-25 20:30+09',
      '隅田川河川敷', '東京都台東区', '台東', 'seasonal',
      'https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?w=800',
      'https://example.com/sumida-fireworks', null,
      'user', 'seed-002', true
    ),
    (
      'チームラボ ボーダレス 常設展',
      '境界のないアートで構成される地図のないミュージアム。',
      '2026-05-22 10:00+09', '2026-12-31 21:00+09',
      'チームラボボーダレス', '東京都港区麻布台1-2-4', '港', 'art',
      'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800',
      'https://example.com/teamlab-borderless', null,
      'user', 'seed-003', true
    ),
    (
      '森山大道 写真展「ストリート」',
      '日本を代表する写真家・森山大道の最新写真展。',
      '2026-06-10 11:00+09', '2026-08-30 19:00+09',
      '東京都写真美術館', '東京都目黒区三田1-13-3', '目黒', 'art',
      'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=800',
      'https://example.com/moriyama', '2026-05-25 10:00+09',
      'user', 'seed-004', true
    ),
    (
      'Blue Note Tokyo - ロバート・グラスパー',
      'グラミー賞5回受賞のキーボーディスト、ロバート・グラスパー来日公演。',
      '2026-06-15 19:00+09', '2026-06-15 21:30+09',
      'Blue Note Tokyo', '東京都港区南青山6-3-16', '港', 'music',
      'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800',
      'https://example.com/bluenote-glasper', '2026-05-22 10:00+09',
      'user', 'seed-005', true
    ),
    (
      'FUJI ROCK FESTIVAL 東京前夜祭',
      'フジロック開幕前の東京限定アコースティックライブ。',
      '2026-07-23 18:30+09', '2026-07-23 22:00+09',
      'ZEPP DiverCity', '東京都江東区青海1-1-10', '江東', 'music',
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800',
      'https://example.com/fujirock-tokyo', '2026-06-01 10:00+09',
      'user', 'seed-006', true
    ),
    (
      '歌舞伎座 六月大歌舞伎',
      '昼の部・夜の部の二部制。中村勘九郎、市川海老蔵ら出演。',
      '2026-06-02 11:00+09', '2026-06-26 21:00+09',
      '歌舞伎座', '東京都中央区銀座4-12-15', '中央', 'theater',
      'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
      'https://example.com/kabukiza-june', '2026-05-23 10:00+09',
      'user', 'seed-007', true
    ),
    (
      '新国立劇場 オペラ「カルメン」',
      'ビゼーの傑作オペラ、新演出での上演。',
      '2026-09-10 18:30+09', '2026-09-25 22:00+09',
      '新国立劇場', '東京都渋谷区本町1-1-1', '渋谷', 'theater',
      'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800',
      'https://example.com/nntt-carmen', '2026-06-15 10:00+09',
      'user', 'seed-008', true
    ),
    (
      '神田祭 2026',
      '日本三大祭の一つ、神田明神の例大祭。神輿200基が町を練り歩く。',
      '2026-05-09 09:00+09', '2026-05-15 21:00+09',
      '神田明神', '東京都千代田区外神田2-16-2', '千代田', 'festival',
      'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800',
      'https://example.com/kanda-matsuri', null,
      'user', 'seed-009', true
    ),
    (
      '恵比寿ビアフェスティバル 2026',
      'クラフトビール100種類以上が集結。フードトラックも多数出店。',
      '2026-08-15 12:00+09', '2026-08-17 21:00+09',
      '恵比寿ガーデンプレイス', '東京都渋谷区恵比寿4-20', '渋谷', 'food',
      'https://images.unsplash.com/photo-1546058256-47154de4046c?w=800',
      'https://example.com/ebisu-beer', null,
      'user', 'seed-010', true
    ),
    (
      '東京国際映画祭 オープニング上映',
      '今年の話題作を世界に先駆けて上映。レッドカーペットあり。',
      '2026-10-28 18:00+09', '2026-10-28 22:00+09',
      'TOHOシネマズ日比谷', '東京都千代田区有楽町1-1-2', '千代田', 'film',
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
      'https://example.com/tiff-opening', '2026-10-01 10:00+09',
      'user', 'seed-011', true
    ),
    (
      '隈研吾 建築講演会',
      '世界的建築家・隈研吾による特別講演。新国立競技場の設計秘話。',
      '2026-06-20 14:00+09', '2026-06-20 16:30+09',
      '東京大学 安田講堂', '東京都文京区本郷7-3-1', '文京', 'learning',
      'https://images.unsplash.com/photo-1492321936769-b49830bc1d1e?w=800',
      'https://example.com/kuma-lecture', '2026-05-22 10:00+09',
      'user', 'seed-012', true
    )
  returning id, source_id
)
-- =========================================================
-- 各イベントにタグを紐付け
-- =========================================================
insert into public.event_tags (event_id, tag_id)
select i.id, t.id
from inserted i
join public.tags t on t.slug = any(
  case i.source_id
    when 'seed-001' then array['cherry-blossom']
    when 'seed-002' then array['fireworks']
    when 'seed-003' then array['contemporary-art']
    when 'seed-004' then array['photography', 'contemporary-art']
    when 'seed-005' then array['jazz']
    when 'seed-006' then array['rock', 'festival-music']
    when 'seed-007' then array['kabuki']
    when 'seed-008' then array['classical', 'drama']
    when 'seed-009' then array['shrine-festival']
    when 'seed-010' then array['beer-festival', 'food-festival']
    when 'seed-011' then array['film-festival', 'screening']
    when 'seed-012' then array['lecture']
  end
);
