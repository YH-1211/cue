-- 0021 で投入した実イベントの official_url 修正 + ticket_url 追加
--   official_url: 区/会場の汎用トップ → イベント本体ページへ差し替え
--   ticket_url:   有料イベントに公式チケット/予約ページを設定 (無料は NULL のまま)
--   いずれも Web で実在を確認した URL のみ使用。年度版ページ未公開のものは据え置き。

-- ===== 花火大会 =====
-- 葛飾: 区トップ → イベントページ
update public.events set
  official_url = 'https://www.city.katsushika.lg.jp/tourism/1000064/1000065/index.html'
 where source_id = 'real-hanabi-katsushika';

-- 神宮外苑花火 (全席有料): チケット案内ページ
update public.events set
  ticket_url = 'https://www.jinguhanabi.com/ticket.html'
 where source_id = 'real-hanabi-jingu';

-- 江戸川: 区トップ → 花火特設 + 有料席ページ
update public.events set
  official_url = 'https://www.city.edogawa.tokyo.jp/hanabi/',
  ticket_url   = 'https://www.city.edogawa.tokyo.jp/hanabi/p_seat/index.html'
 where source_id = 'real-hanabi-edogawa';

-- いたばし: 有料席ページ
update public.events set
  ticket_url = 'https://itabashihanabi.jp/seat/'
 where source_id = 'real-hanabi-itabashi';

-- ===== 祭り =====
-- 深川八幡祭り: 神社トップ → 祭礼ページ
update public.events set
  official_url = 'https://www.tomiokahachimangu.or.jp/annai/maturi/maturih1.html'
 where source_id = 'real-matsuri-fukagawa';

-- ===== クリスマスマーケット / イルミ =====
-- 六本木ヒルズ: 施設トップ → クリスマス特設サイト
update public.events set
  official_url = 'https://www.christmas.hills-site.com/'
 where source_id = 'real-xmas-roppongi';

-- ===== 紅葉 =====
-- 六義園 ライトアップ: 汎用index → 夜間特別観賞 特設ページ
update public.events set
  official_url = 'https://www.tokyo-park.or.jp/special/rikugien_lighting/index.html'
 where source_id = 'real-koyo-rikugien';

-- ===== アート =====
-- チームラボボーダレス: 予約/チケットサイト
update public.events set
  ticket_url = 'https://borderless.teamlab.art/jp/'
 where source_id = 'real-art-teamlab';

-- ===== 音楽 =====
-- サントリーホール オルガン プロムナード: 会場トップ → シリーズ紹介ページ
update public.events set
  official_url = 'https://www.suntory.co.jp/suntoryhall/article/detail/000748.html'
 where source_id = 'real-music-suntory';

-- Blue Note: 公式オンライン予約
update public.events set
  ticket_url = 'https://reserve.bluenote.co.jp/reserve/mb_schedule/'
 where source_id = 'real-music-bluenote';

-- ===== 舞台 =====
-- 歌舞伎座 七月大歌舞伎: 公式演目ページ + チケットWeb松竹
update public.events set
  official_url = 'https://www.kabuki-bito.jp/theaters/kabukiza/play/976/',
  ticket_url   = 'https://www1.ticket-web-shochiku.com/t/'
 where source_id = 'real-theater-kabukiza';

-- 劇団四季 ライオンキング: 公式作品ページ + チケットポータル
update public.events set
  official_url = 'https://www.shiki.jp/applause/lionking/ticket_schedule/',
  ticket_url   = 'https://www.shiki.jp/tickets/'
 where source_id = 'real-theater-shiki';

-- ===== フード =====
-- 恵比寿ビアフェス: 施設トップ → ビアフェス東京 公式 (有料入場。購入も同サイト)
update public.events set
  official_url = 'https://beerfes.jp/tokyo2026/'
 where source_id = 'real-food-ebisubeer';

-- ===== 映像 =====
-- 東京国際映画祭: 年度版公式サイト
update public.events set
  official_url = 'https://2026.tiff-jp.net/ja/'
 where source_id = 'real-film-tiff';

-- ===== 学び =====
-- デザインフェスタ: チケット案内ページ
update public.events set
  ticket_url = 'https://designfesta.com/about-ticket/'
 where source_id = 'real-learning-designfesta';
