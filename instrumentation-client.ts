import * as Sentry from "@sentry/nextjs";

// ブラウザ側の初期化。ハイドレーション前に実行される
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
  });
}

// クライアントのルーター遷移を Sentry に伝える（計測用）
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
