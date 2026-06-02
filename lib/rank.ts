// ポイントに応じたランク (称号) 定義。
//   換金等はせず、貯めたポイントで称号が上がる仕組み。
//   /me と /users/[id] でバッジ表示する。

export type Rank = {
  /** 到達に必要な累積ポイント (これ以上で該当) */
  minPoints: number;
  /** 称号 */
  label: string;
  /** 絵文字アイコン */
  icon: string;
  /** バッジ配色 (Tailwind クラス) */
  className: string;
};

// minPoints 降順で並べる (find で最初にマッチしたものが現在のランク)
export const RANKS: Rank[] = [
  {
    minPoints: 400,
    label: "レジェンド",
    icon: "👑",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    minPoints: 150,
    label: "達人",
    icon: "⭐",
    className: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    minPoints: 50,
    label: "常連",
    icon: "🎫",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    minPoints: 10,
    label: "探検家",
    icon: "🧭",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    minPoints: 0,
    label: "ビギナー",
    icon: "🌱",
    className: "bg-muted text-muted-foreground",
  },
];

/** 現在のポイントに対応するランクを返す */
export function rankFor(points: number): Rank {
  return RANKS.find((r) => points >= r.minPoints) ?? RANKS[RANKS.length - 1];
}

/** 次のランクまでの情報。最上位なら null。 */
export function nextRank(points: number): { rank: Rank; remaining: number } | null {
  // minPoints 昇順で、現在より上の最初のもの
  const higher = [...RANKS]
    .sort((a, b) => a.minPoints - b.minPoints)
    .find((r) => r.minPoints > points);
  if (!higher) return null;
  return { rank: higher, remaining: higher.minPoints - points };
}
