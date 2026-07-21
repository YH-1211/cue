import * as Sentry from "@sentry/nextjs";

// Next.js サーバー起動時に一度だけ呼ばれる。ランタイム別に Sentry を初期化
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// サーバー側で捕捉されたエラーを Sentry に送る
export const onRequestError = Sentry.captureRequestError;
