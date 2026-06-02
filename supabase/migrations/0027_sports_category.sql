-- スポーツ観戦カテゴリを追加。
--   親 'sports' + サブ (野球 / サッカー / バスケ / 相撲 / マラソン)。
--   親↔子の対応は lib/events.ts のコード側で管理する (既存カテゴリと同じ方針)。
--   ※ ALTER TYPE ADD VALUE はトランザクション制約があるため 1 文ずつ適用する。
alter type event_category add value if not exists 'sports';
alter type event_category add value if not exists 'sports_baseball';
alter type event_category add value if not exists 'sports_soccer';
alter type event_category add value if not exists 'sports_basketball';
alter type event_category add value if not exists 'sports_sumo';
alter type event_category add value if not exists 'sports_marathon';
