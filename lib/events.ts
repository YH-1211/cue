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

// タイトル・説明テキストからカテゴリーを推定する (キーワードベース)。
// 上から順に評価し、最初にヒットしたカテゴリーを返す (具体的な祭り種別を先に置く)。
// 自動入力の初期値用。確信度は高くないので、フォーム側で人が確認・修正する前提。
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [EventCategory, readonly string[]]> = [
  ["festival_hanabi", ["花火"]],
  ["festival_natsu", ["盆踊", "納涼", "夏祭", "阿波踊", "阿波おど", "サンバ", "よさこい", "七夕"]],
  ["festival_ennichi", ["縁日", "ほおずき市", "朝顔市", "べったら市", "酉の市", "屋台村"]],
  ["festival_shrine", ["例大祭", "例祭", "大祭", "神輿", "神幸", "祭礼", "供養", "御会式", "お会式", "みたままつり", "だらだら祭"]],
  ["seasonal_xmas", ["クリスマス", "イルミネーション", "クリスマスマーケット"]],
  ["seasonal_sakura", ["桜", "花見", "さくら"]],
  ["seasonal_koyo", ["紅葉", "もみじ", "ライトアップ"]],
  ["seasonal_ajisai", ["あじさい", "紫陽花", "梅まつり", "梅祭"]],
  ["seasonal_hatsumode", ["初詣", "初日の出"]],
  ["food_drink", ["オクトーバーフェス", "ビアガーデン", "ビアフェス", "ビール", "ワイン", "日本酒", "梅酒", "クラフトビール", "酒祭"]],
  ["food_gourmet", ["グルメ", "肉フェス", "ラーメン", "フードフェス", "うまいもの", "はちみつフェス", "カレー", "餃子", "フェスティバル"]],
  ["food_market", ["マルシェ", "ファーマーズ", "フリーマーケット", "フリマ", "朝市"]],
  ["theater_musical", ["ミュージカル", "劇団四季", "宝塚", "オペラ"]],
  ["theater_rakugo", ["落語", "寄席", "講談", "演芸"]],
  ["theater_dance", ["バレエ", "コンテンポラリーダンス", "舞踏"]],
  ["theater_play", ["歌舞伎", "演劇", "舞台", "新国立劇場", "文楽", "能楽", "狂言"]],
  ["music_classic", ["交響楽団", "管弦楽", "オーケストラ", "クラシック", "コンサート", "リサイタル", "第九", "フィルハーモニー", "室内楽"]],
  ["music_jazz", ["ジャズ", "JAZZ"]],
  ["music_club", ["EDM", "ULTRA", "クラブ", "DJ", "テクノ", "レイヴ"]],
  ["music_idol", ["アイドル", "ハロプロ", "総選挙"]],
  ["music_rock", ["ライブ", "ツアー", "ロック", "フェス", "ワンマン", "music tour"]],
  ["art_photo", ["写真展", "フォト"]],
  ["art_craft", ["工芸", "クラフト", "デザイン", "陶芸", "やきもの", "DESIGNART", "デザインフェスタ"]],
  ["art_traditional", ["美術館", "美術展", "絵画", "日本画", "浮世絵", "名宝", "コレクション展", "博物館", "○○展", "肖像"]],
  ["art_contemporary", ["現代アート", "現代美術", "インスタレーション", "アートフェア", "ビエンナーレ"]],
  ["film_anime", ["アニメ", "コミック", "COMITIA", "コミティア", "同人"]],
  ["film_festival", ["映画祭"]],
  ["film_movie", ["上映", "映画"]],
  ["learning_tech", ["テック", "エンジニア", "ハッカソン", "カンファレンス", "勉強会"]],
  ["learning_workshop", ["ワークショップ", "体験教室", "手作り体験"]],
  ["learning_family", ["親子", "子ども", "ファミリー", "キッズ"]],
  ["learning_talk", ["トークショー", "講演", "シンポジウム", "セミナー"]],
  ["sports_sumo", ["大相撲", "相撲", "場所"]],
  ["sports_baseball", ["野球", "プロ野球", "東京ドーム", "神宮球場", "ベイスターズ", "スワローズ"]],
  ["sports_soccer", ["サッカー", "Jリーグ", "天皇杯", "代表戦"]],
  ["sports_basketball", ["バスケ", "B.LEAGUE", "Bリーグ"]],
  ["sports_marathon", ["マラソン", "ハーフマラソン", "駅伝", "ラン"]],
  // 親カテゴリーのみの広いフォールバック
  ["festival", ["祭り", "まつり", "フェスティバル"]],
  ["art", ["アート", "展覧会", "ギャラリー"]],
  ["music", ["音楽", "演奏"]],
];

export function inferCategory(text: string): EventCategory | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (text.includes(kw) || lower.includes(kw.toLowerCase())) {
        return category;
      }
    }
  }
  return null;
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
