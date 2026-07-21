import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash の環境変数が揃っている時だけレート制限を有効化する。
// 未設定 (ローカル開発など) なら null になり、レート制限は素通り = 無効。
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// 同じ設定の Ratelimit を使い回すためのキャッシュ (無駄なインスタンス生成を防ぐ)
const limiters = new Map<string, Ratelimit>();

function getLimiter(
  name: string,
  limit: number,
  windowSec: number
): Ratelimit | null {
  if (!redis) return null;
  const cacheKey = `${name}:${limit}:${windowSec}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `cue:rl:${name}`,
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

// Vercel などのプロキシ越しでも実クライアント IP を推定する。
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

type RateLimitOptions = {
  // 制限のグループ名 (エンドポイントごとに分ける)
  name: string;
  // windowSec 秒あたりの許可リクエスト数
  limit: number;
  // 集計窓の長さ (秒)
  windowSec: number;
};

// レート制限を確認する。上限超過なら 429 の NextResponse を返す。
// 制限内、または Upstash 未設定なら null を返す (呼び出し側は処理を続行する)。
export async function enforceRateLimit(
  req: NextRequest,
  opts: RateLimitOptions
): Promise<NextResponse | null> {
  const limiter = getLimiter(opts.name, opts.limit, opts.windowSec);
  if (!limiter) return null;

  const ip = clientIp(req);
  const { success, limit, remaining, reset } = await limiter.limit(
    `${opts.name}:${ip}`
  );
  if (success) return null;

  const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "リクエストが多すぎます。少し時間をおいて再度お試しください。" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
      },
    }
  );
}
