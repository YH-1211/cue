// サイト全体で使う運営情報。
// ⚠️ 公開前に必ず実際の値に書き換えること（下の TODO 箇所）。
export const SITE = {
  name: "Cue",
  // 本番URL（OGP・絶対URL生成・metadataBase に使う）
  url: "https://cue-taupe-eight.vercel.app",
  // シェア時のキャッチコピー
  tagline: "行きたいが、見つかる。",
  // 運営者名（屋号・団体名）
  operator: "グランフィットグループ株式会社",
  // 問い合わせ・通報を受け取るメールアドレス
  contactEmail: "yuma.hirahara@gfg01.co.jp",
  // 規約・ポリシーの制定日（必要に応じて改定日を更新）
  effectiveDate: "2026年6月3日",
} as const;
