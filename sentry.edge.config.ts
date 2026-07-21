import * as Sentry from "@sentry/nextjs";

// Edge ランタイム（proxy.ts など）用の初期化
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
  });
}
