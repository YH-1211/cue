// ============================================================
// Cue PM2 設定（Dockerを使わない方式B用）
// 使い方:
//   1) このファイルをプロジェクトルートにコピー
//   2) npm ci && npm run build
//   3) pm2 start ecosystem.config.js && pm2 save && pm2 startup
//
// 環境変数は .env.local から読まれる（Next.js が自動で読み込む）。
// ============================================================

module.exports = {
  apps: [
    {
      name: "cue",
      // Next.js 16 の本番サーバーを起動
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1, // 必要ならCPU数に応じて "max" + exec_mode:"cluster"
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      // ログ
      out_file: "/var/log/cue-out.log",
      error_file: "/var/log/cue-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
