-- B: カテゴリー2階層化 — サブカテゴリーを event_category enum に追加
--   親 (art/music/theater/festival/food/seasonal/film/learning) は据え置き。
--   既存イベントは親値のまま有効。新規はサブまで指定可。
--   親↔子の対応は lib/events.ts のコード側で管理する (軽量2階層)。
--   ※ ALTER TYPE ADD VALUE はトランザクション制約があるため 1 文ずつ適用する。
alter type event_category add value if not exists 'art_contemporary';
alter type event_category add value if not exists 'art_photo';
alter type event_category add value if not exists 'art_craft';
alter type event_category add value if not exists 'art_traditional';
alter type event_category add value if not exists 'music_rock';
alter type event_category add value if not exists 'music_classic';
alter type event_category add value if not exists 'music_jazz';
alter type event_category add value if not exists 'music_club';
alter type event_category add value if not exists 'music_idol';
alter type event_category add value if not exists 'theater_play';
alter type event_category add value if not exists 'theater_musical';
alter type event_category add value if not exists 'theater_dance';
alter type event_category add value if not exists 'theater_rakugo';
alter type event_category add value if not exists 'festival_hanabi';
alter type event_category add value if not exists 'festival_natsu';
alter type event_category add value if not exists 'festival_ennichi';
alter type event_category add value if not exists 'festival_shrine';
alter type event_category add value if not exists 'food_gourmet';
alter type event_category add value if not exists 'food_drink';
alter type event_category add value if not exists 'food_market';
alter type event_category add value if not exists 'seasonal_sakura';
alter type event_category add value if not exists 'seasonal_koyo';
alter type event_category add value if not exists 'seasonal_illumi';
alter type event_category add value if not exists 'seasonal_xmas';
alter type event_category add value if not exists 'seasonal_hatsumode';
alter type event_category add value if not exists 'seasonal_ajisai';
alter type event_category add value if not exists 'film_movie';
alter type event_category add value if not exists 'film_anime';
alter type event_category add value if not exists 'film_festival';
alter type event_category add value if not exists 'learning_talk';
alter type event_category add value if not exists 'learning_workshop';
alter type event_category add value if not exists 'learning_tech';
alter type event_category add value if not exists 'learning_family';
