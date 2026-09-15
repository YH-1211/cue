// Google Search Console の検索パフォーマンス（表示回数・クリック数）を取得する。
//
// 認証はサービスアカウントの JWT を自前で署名して行う（外部ライブラリ不要）。
// 事前準備:
//   1. Google Cloud でサービスアカウントを作成し、JSON キーを発行
//   2. そのプロジェクトで「Google Search Console API」を有効化
//   3. Search Console のプロパティ設定 > ユーザーと権限 で
//      サービスアカウントのメールアドレスを「制限付き」で追加
//   4. JSON キーを base64 にして .env.local の GOOGLE_SERVICE_ACCOUNT_JSON に保存
//
// 使い方:
//   node scripts/search-console.mjs [取得する日数(既定28)]

import { createSign } from "node:crypto";

const SITE_URL = "https://queevent.com/";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error(
      "GOOGLE_SERVICE_ACCOUNT_JSON が未設定です。.env.local を読み込んでから実行してください。"
    );
    process.exit(1);
  }
  // base64 でも生の JSON でも受け付ける
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const creds = JSON.parse(text);
  if (!creds.client_email || !creds.private_key) {
    throw new Error("サービスアカウントの JSON に client_email / private_key がありません");
  }
  return creds;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// サービスアカウントの秘密鍵で署名した JWT をアクセストークンに交換する
async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer
    .sign(creds.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`トークン取得に失敗 (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function query(token, body) {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    SITE_URL
  )}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`API エラー (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.rows ?? [];
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const days = Number(process.argv[2] ?? 28);
  const creds = loadCredentials();
  const token = await getAccessToken(creds);

  // Search Console のデータは2〜3日遅れて確定するため、終端は当日にしておく
  const endDate = ymd(new Date());
  const startDate = ymd(new Date(Date.now() - days * 86400_000));
  const range = { startDate, endDate };

  const byDate = await query(token, {
    ...range,
    dimensions: ["date"],
    rowLimit: 500,
  });

  const totals = byDate.reduce(
    (acc, r) => {
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      return acc;
    },
    { impressions: 0, clicks: 0 }
  );

  console.log(`■ 期間 ${startDate} 〜 ${endDate}`);
  console.log(`  表示回数 ${totals.impressions} / クリック ${totals.clicks}`);
  console.log("");

  console.log("■ 日別");
  if (byDate.length === 0) {
    console.log("  データなし（公開直後は数日かかります）");
  }
  for (const r of byDate.slice(-14)) {
    console.log(
      `  ${r.keys[0]}  表示 ${String(r.impressions).padStart(5)}  クリック ${String(
        r.clicks
      ).padStart(3)}  平均掲載順位 ${r.position.toFixed(1)}`
    );
  }
  console.log("");

  const byQuery = await query(token, {
    ...range,
    dimensions: ["query"],
    rowLimit: 10,
  });
  console.log("■ 検索キーワード 上位10");
  if (byQuery.length === 0) console.log("  データなし");
  for (const r of byQuery) {
    console.log(
      `  ${r.keys[0]}  表示 ${r.impressions}  クリック ${r.clicks}  順位 ${r.position.toFixed(1)}`
    );
  }
  console.log("");

  const byPage = await query(token, {
    ...range,
    dimensions: ["page"],
    rowLimit: 10,
  });
  console.log("■ 表示されているページ 上位10");
  if (byPage.length === 0) console.log("  データなし");
  for (const r of byPage) {
    console.log(`  ${r.keys[0]}  表示 ${r.impressions}  クリック ${r.clicks}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
