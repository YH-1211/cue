import * as Sentry from "@sentry/nextjs";

// DSN が無い環境（ローカルや未設定の本番）では初期化しない
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // パフォーマンストレースは軽めに（小規模アプリなので 10%）
    tracesSampleRate: 0.1,
    // 本番以外ではイベントを送らない
    enabled: process.env.NODE_ENV === "production",
  });
}
