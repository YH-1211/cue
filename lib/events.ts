// イベント関連の共通ユーティリティ

// 親カテゴリー (enum の最初の8値。既存イベントはこの値を持つ)
export const PARENT_CATEGORIES = [
  "art",
  "music",
  "theater",
  "festival",
  "food",
  "seasonal",
  "film",
  "learning",
  "sports",
] as const;

export type ParentCategory = (typeof PARENT_CATEGORIES)[number];

// 親 → サブカテゴリー (軽量2階層。サブも enum 値)
export const SUBCATEGORIES = {
  art: ["art_contemporary", "art_photo", "art_craft", "art_traditional"],
  music: [
    "music_rock",
    "music_classic",
    "music_jazz",
    "music_club",
    "music_idol",
  ],
  theater: ["theater_play", "theater_musical", "theater_dance", "theater_rakugo"],
  festival: [
    "festival_hanabi",
    "festival_natsu",
    "festival_ennichi",
    "festival_shrine",
  ],
  food: ["food_gourmet", "food_drink", "food_market"],
  seasonal: [
    "seasonal_sakura",
    "seasonal_koyo",
    "seasonal_illumi",
    "seasonal_xmas",
    "seasonal_hatsumode",
    "seasonal_ajisai",
  ],
  film: ["film_movie", "film_anime", "film_festival"],
  learning: [
    "learning_talk",
    "learning_workshop",
    "learning_tech",
    "learning_family",
  ],
  sports: [
    "sports_baseball",
    "sports_soccer",
    "sports_basketball",
    "sports_sumo",
    "sports_marathon",
  ],
} as const satisfies Record<ParentCategory, readonly string[]>;

// 全カテゴリー (親 + サブ)。DB enum と一致する。
export const EVENT_CATEGORIES = [
  ...PARENT_CATEGORIES,
  ...Object.values(SUBCATEGORIES).flat(),
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// 親ラベル
export const PARENT_LABELS: Record<ParentCategory, string> = {
  art: "アート",
  music: "音楽",
  theater: "舞台",
  festival: "祭り",
  food: "フード",
  seasonal: "季節",
  film: "映像",
  learning: "学び",
  sports: "スポーツ",
};

// サブカテゴリーラベル
export const SUBCATEGORY_LABELS: Record<string, string> = {
  art_contemporary: "現代アート",
  art_photo: "写真",
  art_craft: "工芸・デザイン",
  art_traditional: "伝統美術",
  music_rock: "ロック・ポップ",
  music_classic: "クラシック",
  music_jazz: "ジャズ",
  music_club: "EDM・クラブ",
  music_idol: "アイドル",
  theater_play: "演劇",
  theater_musical: "ミュージカル",
  theater_dance: "ダンス",
  theater_rakugo: "落語・演芸",
  festival_hanabi: "花火大会",
  festival_natsu: "夏祭り・盆踊り",
  festival_ennichi: "縁日・屋台",
  festival_shrine: "神社・寺",
  food_gourmet: "グルメフェス",
  food_drink: "ビール・日本酒",
  food_market: "マーケット・フリマ",
  seasonal_sakura: "桜・花見",
  seasonal_koyo: "紅葉",
  seasonal_illumi: "イルミネーション",
  seasonal_xmas: "クリスマスマーケット",
  seasonal_hatsumode: "初詣",
  seasonal_ajisai: "梅・あじさい",
  film_movie: "映画上映",
  film_anime: "アニメ・漫画",
  film_festival: "映画祭",
  learning_talk: "トーク・講演",
  learning_workshop: "ワークショップ",
  learning_tech: "テック・ビジネス",
  learning_family: "子ども・ファミリー",
  sports_baseball: "野球",
  sports_soccer: "サッカー",
  sports_basketball: "バスケ",
  sports_sumo: "相撲",
  sports_marathon: "マラソン・ラン",
};

// 全カテゴリーのラベル (親 + サブ)。バッジ表示等で使う。
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  ...PARENT_LABELS,
  ...SUBCATEGORY_LABELS,
} as Record<EventCategory, string>;

// サブ → 親 の逆引き
const SUB_TO_PARENT: Record<string, ParentCategory> = (() => {
  const map: Record<string, ParentCategory> = {};
  for (const parent of PARENT_CATEGORIES) {
    for (const sub of SUBCATEGORIES[parent]) {
      map[sub] = parent;
    }
  }
  return map;
})();

export function isEventCategory(value: string): value is EventCategory {
  return (EVENT_CATEGORIES as readonly string[]).includes(value);
}

export function isParentCategory(value: string): value is ParentCategory {
  return (PARENT_CATEGORIES as readonly string[]).includes(value);
}

// 任意のカテゴリーから親を返す (親はそのまま、サブは親へ)
export function parentOf(category: EventCategory): ParentCategory {
  if (isParentCategory(category)) return category;
  return SUB_TO_PARENT[category] ?? "art";
}

// 親で絞り込む際にヒットさせる値の集合 (親値 + 配下サブ全部)。
// 既存イベントは親値を持つため、親値自体も含める。
export function categoriesUnderParent(parent: ParentCategory): EventCategory[] {
  return [parent, ...SUBCATEGORIES[parent]] as EventCategory[];
}

// 表示用ラベル (未知の値でも落ちないように)
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as EventCategory] ?? category;
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Tokyo",
});

export function formatEventDateTime(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatEventDate(iso: string): string {
  return dateOnlyFormatter.format(new Date(iso));
}

const shortDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

// Asia/Tokyo での YYYY-MM-DD 文字列 (同日判定用)
function tokyoDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
}

// イベントの日程ラベル。会期もの(開始〜終了)が開催中なら「開催中」を示す。
// - starts_at が無い: 日程調整中
// - 開催中(now が starts_at〜ends_at の間): { ongoing:true, text:"開催中・〜M/D まで" }
// - それ以外(未来 or 単日): 通常の日時表示
export function eventScheduleLabel(
  startsAt: string | null,
  endsAt: string | null
): { text: string; ongoing: boolean } {
  if (!startsAt) return { text: "日程調整中", ongoing: false };

  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start;

  if (now >= start && now <= end) {
    // 終了日が開始日と別日なら「〜M/D まで」を付ける
    const multiDay = endsAt && tokyoDateKey(startsAt) !== tokyoDateKey(endsAt);
    return {
      text: multiDay
        ? `開催中・${shortDateFormatter.format(new Date(endsAt!))} まで`
        : "開催中",
      ongoing: true,
    };
  }

  return { text: dateFormatter.format(new Date(startsAt)), ongoing: false };
}
