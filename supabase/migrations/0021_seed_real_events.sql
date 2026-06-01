-- Cue 実イベント seed (東京・2026年後半〜冬)
--   サブカテゴリーを活用した実在の定例イベント中心。
--   花火大会・クリスマスマーケット・イルミネーションなど季節イベントを厚めに収録。
--   冪等性: source_id like 'real-%' を毎回削除してから再投入する。
--   日付は概ね例年の開催時期に基づく目安 (年により変動するため要確認)。

delete from public.events
 where source_type = 'user'
   and source_id like 'real-%';

insert into public.events (
  title, description, starts_at, ends_at,
  venue_name, address, area, category,
  cover_image_url, official_url,
  ticket_sale_starts_at, source_type, source_id, approved
)
values
  -- ===== 花火大会 (festival_hanabi) =====
  (
    '隅田川花火大会 2026',
    '東京の夏を代表する花火大会。隅田川の夜空を約2万発が彩ります。',
    '2026-07-25 19:00+09', '2026-07-25 20:30+09',
    '隅田川 (桜橋〜言問橋／駒形橋〜厩橋)', '東京都台東区・墨田区', '台東', 'festival_hanabi',
    'https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?w=800',
    'https://www.sumidagawa-hanabi.com/', null,
    'user', 'real-hanabi-sumida', true
  ),
  (
    '葛飾納涼花火大会 2026',
    '打ち上げ場所と観覧席が近く、迫力満点。約1万5千発を江戸川河川敷から。',
    '2026-07-21 19:20+09', '2026-07-21 20:30+09',
    '葛飾区柴又野球場 (江戸川河川敷)', '東京都葛飾区柴又7', '葛飾', 'festival_hanabi',
    'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800',
    'https://www.city.katsushika.lg.jp/', null,
    'user', 'real-hanabi-katsushika', true
  ),
  (
    '神宮外苑花火大会 2026',
    '人気アーティストのライブと花火が同時に楽しめる都心の夏フェス型花火大会。',
    '2026-08-15 19:30+09', '2026-08-15 20:30+09',
    '明治神宮外苑', '東京都新宿区霞ヶ丘町', '新宿', 'festival_hanabi',
    'https://images.unsplash.com/photo-1532635241-17e820acc59f?w=800',
    'https://www.jinguhanabi.com/', '2026-06-01 10:00+09',
    'user', 'real-hanabi-jingu', true
  ),
  (
    '江戸川区花火大会 2026',
    'オープニング5秒で1000発の圧巻の幕開け。約1万4千発が打ち上がります。',
    '2026-08-01 19:15+09', '2026-08-01 20:30+09',
    '江戸川河川敷 (都立篠崎公園先)', '東京都江戸川区上篠崎1', '江戸川', 'festival_hanabi',
    'https://images.unsplash.com/photo-1507608443039-bfde4fbcd142?w=800',
    'https://www.city.edogawa.tokyo.jp/', null,
    'user', 'real-hanabi-edogawa', true
  ),
  (
    'いたばし花火大会 2026',
    '都内最大級の尺五寸玉や東京最長クラスのナイアガラが見どころ。',
    '2026-08-01 19:00+09', '2026-08-01 20:30+09',
    '荒川河川敷 (板橋区側)', '東京都板橋区舟渡4', '板橋', 'festival_hanabi',
    'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800',
    'https://itabashihanabi.jp/', null,
    'user', 'real-hanabi-itabashi', true
  ),

  -- ===== 夏祭り (festival_natsu / festival_shrine) =====
  (
    '深川八幡祭り (富岡八幡宮例大祭)',
    '江戸三大祭の一つ。沿道から水を浴びせる「水掛け祭り」で知られます。',
    '2026-08-15 07:30+09', '2026-08-16 18:00+09',
    '富岡八幡宮', '東京都江東区富岡1-20-3', '江東', 'festival_shrine',
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800',
    'https://www.tomiokahachimangu.or.jp/', null,
    'user', 'real-matsuri-fukagawa', true
  ),
  (
    '阿佐ヶ谷七夕まつり 2026',
    '商店街を彩る巨大な張りぼて飾りが名物の、関東有数の七夕まつり。',
    '2026-08-05 10:00+09', '2026-08-10 20:00+09',
    '阿佐谷パールセンター商店街', '東京都杉並区阿佐谷南', '杉並', 'festival_natsu',
    'https://images.unsplash.com/photo-1565728744382-61accd4aa148?w=800',
    'https://www.asagaya.or.jp/', null,
    'user', 'real-matsuri-asagaya', true
  ),

  -- ===== クリスマスマーケット (seasonal_xmas) =====
  (
    '東京クリスマスマーケット 2026 in 日比谷公園',
    '本場ドイツ仕込みのヒュッテが並び、グリューワインや雑貨を楽しめる都内最大級のマーケット。',
    '2026-12-11 11:00+09', '2026-12-25 22:00+09',
    '日比谷公園 噴水広場', '東京都千代田区日比谷公園1-6', '千代田', 'seasonal_xmas',
    'https://images.unsplash.com/photo-1543589077-47d81606c1bf?w=800',
    'https://tokyochristmas.net/', null,
    'user', 'real-xmas-hibiya', true
  ),
  (
    '六本木ヒルズ クリスマスマーケット 2026',
    'けやき坂のイルミネーションとともに楽しむ、毎年人気のクリスマスマーケット。',
    '2026-11-28 11:00+09', '2026-12-25 21:00+09',
    '六本木ヒルズ 大屋根プラザ', '東京都港区六本木6-10-1', '港', 'seasonal_xmas',
    'https://images.unsplash.com/photo-1576919228236-a097c32a5cd4?w=800',
    'https://www.roppongihills.com/', null,
    'user', 'real-xmas-roppongi', true
  ),

  -- ===== イルミネーション (seasonal_illumi) =====
  (
    '丸の内イルミネーション 2026',
    '丸の内仲通りの街路樹約340本がシャンパンゴールドに輝く、冬の風物詩。',
    '2026-11-12 16:00+09', '2027-02-15 23:00+09',
    '丸の内仲通り', '東京都千代田区丸の内', '千代田', 'seasonal_illumi',
    'https://images.unsplash.com/photo-1513297887119-d46091b24bfa?w=800',
    'https://www.marunouchi.com/', null,
    'user', 'real-illumi-marunouchi', true
  ),
  (
    '東京ミッドタウン クリスマス イルミネーション 2026',
    '芝生広場に広がる青の光の海「スターライトガーデン」が見どころ。',
    '2026-11-13 17:00+09', '2026-12-25 23:00+09',
    '東京ミッドタウン', '東京都港区赤坂9-7-1', '港', 'seasonal_illumi',
    'https://images.unsplash.com/photo-1482329833197-916d32bdf693?w=800',
    'https://www.tokyo-midtown.com/', null,
    'user', 'real-illumi-midtown', true
  ),

  -- ===== 紅葉 (seasonal_koyo) =====
  (
    '神宮外苑 いちょう並木 2026',
    '青山通りから聖徳記念絵画館へ続く約300mの黄金のいちょうトンネル。',
    '2026-11-15 09:00+09', '2026-12-06 17:00+09',
    '神宮外苑 いちょう並木', '東京都港区北青山2', '港', 'seasonal_koyo',
    'https://images.unsplash.com/photo-1511497584788-876760111969?w=800',
    'https://www.meijijingugaien.jp/', null,
    'user', 'real-koyo-gaien', true
  ),
  (
    '六義園 紅葉と大名庭園のライトアップ',
    '大名庭園の紅葉が水面に映り込む幻想的な夜間特別観賞。',
    '2026-11-21 09:00+09', '2026-12-06 21:00+09',
    '六義園', '東京都文京区本駒込6-16-3', '文京', 'seasonal_koyo',
    'https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?w=800',
    'https://www.tokyo-park.or.jp/park/format/index039.html', null,
    'user', 'real-koyo-rikugien', true
  ),

  -- ===== アート (art_contemporary / art_photo) =====
  (
    'チームラボボーダレス：森ビル デジタルアート ミュージアム',
    '境界のないアート群が連続する、地図のないミュージアム。常設展示。',
    '2026-06-01 10:00+09', '2026-12-27 21:00+09',
    'チームラボボーダレス 麻布台ヒルズ', '東京都港区麻布台1-2-4', '港', 'art_contemporary',
    'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800',
    'https://www.teamlab.art/jp/e/borderless-azabudai/', null,
    'user', 'real-art-teamlab', true
  ),
  (
    '東京都写真美術館 コレクション展',
    '日本最大級の写真・映像専門美術館。所蔵作品による企画展示。',
    '2026-07-04 10:00+09', '2026-09-23 18:00+09',
    '東京都写真美術館', '東京都目黒区三田1-13-3 恵比寿ガーデンプレイス内', '目黒', 'art_photo',
    'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=800',
    'https://topmuseum.jp/', null,
    'user', 'real-art-topmuseum', true
  ),

  -- ===== 音楽 (music_jazz / music_classic) =====
  (
    'Blue Note Tokyo ジャズライブ',
    '世界の一流ジャズミュージシャンが集う、南青山の名門ジャズクラブ。',
    '2026-06-20 19:00+09', '2026-06-20 21:30+09',
    'Blue Note Tokyo', '東京都港区南青山6-3-16', '港', 'music_jazz',
    'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800',
    'https://www.bluenote.co.jp/', '2026-05-29 10:00+09',
    'user', 'real-music-bluenote', true
  ),
  (
    'サントリーホール オルガン プロムナード コンサート',
    '世界有数のパイプオルガンによる入場無料のランチタイムコンサート。',
    '2026-07-01 12:15+09', '2026-07-01 12:45+09',
    'サントリーホール 大ホール', '東京都港区赤坂1-13-1', '港', 'music_classic',
    'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800',
    'https://www.suntory.co.jp/suntoryhall/', null,
    'user', 'real-music-suntory', true
  ),

  -- ===== 舞台 (theater_play / theater_musical / theater_rakugo) =====
  (
    '歌舞伎座 七月大歌舞伎',
    '昼の部・夜の部の二部制。歌舞伎座で味わう本格的な古典芸能。',
    '2026-07-04 11:00+09', '2026-07-27 21:00+09',
    '歌舞伎座', '東京都中央区銀座4-12-15', '中央', 'theater_play',
    'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
    'https://www.kabuki-za.co.jp/', '2026-06-12 10:00+09',
    'user', 'real-theater-kabukiza', true
  ),
  (
    '劇団四季『ライオンキング』',
    'ロングラン上演中のミュージカルの金字塔。圧巻の舞台演出。',
    '2026-08-01 13:00+09', '2026-08-01 15:45+09',
    '有明四季劇場', '東京都江東区有明1-3-5', '江東', 'theater_musical',
    'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
    'https://www.shiki.jp/', null,
    'user', 'real-theater-shiki', true
  ),
  (
    '新宿末廣亭 寄席',
    '昼夜入れ替えなしで楽しめる、新宿の老舗寄席。落語・漫才・色物。',
    '2026-06-15 12:00+09', '2026-06-15 21:00+09',
    '新宿末廣亭', '東京都新宿区新宿3-6-12', '新宿', 'theater_rakugo',
    'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800',
    'https://suehirotei.com/', null,
    'user', 'real-theater-suehirotei', true
  ),

  -- ===== フード (food_drink / food_market) =====
  (
    '恵比寿ビアフェスティバル 2026',
    'クラフトビールが恵比寿ガーデンプレイスに集結。フードも充実。',
    '2026-08-14 12:00+09', '2026-08-16 21:00+09',
    '恵比寿ガーデンプレイス センター広場', '東京都渋谷区恵比寿4-20', '渋谷', 'food_drink',
    'https://images.unsplash.com/photo-1546058256-47154de4046c?w=800',
    'https://gardenplace.jp/', null,
    'user', 'real-food-ebisubeer', true
  ),
  (
    '青山ファーマーズマーケット',
    '毎週末開催。都市と農を繋ぐ、新鮮野菜と作り手が集まるマーケット。',
    '2026-06-13 10:00+09', '2026-06-14 16:00+09',
    '国連大学前広場', '東京都渋谷区神宮前5-53-70', '渋谷', 'food_market',
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800',
    'https://farmersmarkets.jp/', null,
    'user', 'real-food-farmers', true
  ),

  -- ===== 映像 (film_festival) =====
  (
    '東京国際映画祭 2026',
    'アジア最大級の国際映画祭。話題作の上映やレッドカーペットを開催。',
    '2026-10-26 10:00+09', '2026-11-04 22:00+09',
    '日比谷・有楽町・銀座エリア', '東京都千代田区有楽町', '千代田', 'film_festival',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
    'https://www.tiff-jp.net/', '2026-10-10 10:00+09',
    'user', 'real-film-tiff', true
  ),

  -- ===== 学び (learning_tech / learning_workshop) =====
  (
    'デザインフェスタ vol.64',
    'プロ・アマ問わず誰でも参加できるアジア最大級のアートイベント。',
    '2026-11-14 11:00+09', '2026-11-15 18:00+09',
    '東京ビッグサイト', '東京都江東区有明3-11-1', '江東', 'learning_workshop',
    'https://images.unsplash.com/photo-1492321936769-b49830bc1d1e?w=800',
    'https://designfesta.com/', null,
    'user', 'real-learning-designfesta', true
  );
