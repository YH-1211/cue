# Xserver VPS への移行：具体手順

`移行手順.md` の汎用版を、**Xserver VPS 専用**に噛み砕いたもの。
Docker方式（方式A）で進める前提。クロちゃん作。

---

## STEP 1. VPSを契約する

1. [Xserver VPS](https://vps.xserver.ne.jp/) で申し込み。
2. **プラン**: メモリ **2GB** 以上を推奨（Next.jsのビルドにメモリを使う。1GBだとビルドが落ちることがある）。
3. **イメージタイプ**: 「**OS** → **Ubuntu 24.04**」を選ぶ。
   - （「アプリ → Docker」テンプレートを選べば Docker 導入済みで楽。どちらでもOK。OS版なら STEP3 で自分で入れる）
4. **SSH Key**: 申込時に公開鍵を登録 or パスワード認証を設定。鍵認証推奨。

---

## STEP 2. ファイアウォール（パケットフィルター）を開ける

Xserver VPS は初期状態で **80/443 が閉じている**。これを開けないと外からサイトが見えない。

1. Xserverアカウント → **VPSパネル** → 対象サーバー → **パケットフィルター設定**
2. フィルターを追加で開ける：
   - **SSH (22)** … 管理用（最初から開いてることが多い）
   - **HTTP (80)** … Web
   - **HTTPS (443)** … Web(SSL)
3. 保存。これを忘れると STEP 8 のHTTPS取得で失敗する。

---

## STEP 3. サーバーにログインして下準備

```bash
ssh root@【VPSのIPアドレス】

# パッケージ更新
apt update && apt upgrade -y

# タイムゾーンを日本に（任意だがCronの時刻計算が楽になる）
timedatectl set-timezone Asia/Tokyo

# Docker を入れる（「Docker」テンプレートで契約したならスキップ）
curl -fsSL https://get.docker.com | sh

# git / nginx / certbot を入れる
apt install -y git nginx certbot python3-certbot-nginx
```

---

## STEP 4. コードを持ってくる

```bash
cd /opt
git clone https://github.com/YH-1211/cue.git
cd cue
```

> GitHubがプライベートならデプロイキー設定 or `scp` でローカルから転送。
> `node_modules` と `.next` は転送しない（サーバーで作り直す）。

---

## STEP 5. next.config.ts に1行追加（standalone化）

```bash
nano next.config.ts
```
`experimental:` の上に `output: "standalone",` を足す：
```ts
const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "35mb" },
  },
};
```

---

## STEP 6. 移行ファイルを配置 + 環境変数

```bash
# このフォルダ(移行データ)の中身をプロジェクト直下へコピー
cp 移行データ/Dockerfile .
cp 移行データ/docker-compose.yml .

# 環境変数ファイルを作成（今のVercel/ローカルと同じ値を貼る）
nano .env.local
```
`.env.example` のキーを全部埋める。**Supabaseは同じものを使うので値はそのまま**。

---

## STEP 7. 起動

```bash
docker compose up -d --build
```
ビルドに数分かかる。完了後：
```bash
curl -I http://localhost:3000   # → HTTP/1.1 200 が返ればOK
docker compose logs -f          # ログ確認（Ctrl+Cで抜ける）
```

---

## STEP 8. ドメイン + HTTPS

### 8-1. DNS
ドメイン管理画面で **Aレコード** を VPSのIPに向ける。
（Xserverドメインなら Xserverアカウント内で設定可能）

### 8-2. Nginx
```bash
cp 移行データ/nginx.conf.example /etc/nginx/sites-available/cue
nano /etc/nginx/sites-available/cue   # your-domain を自分のドメインに書き換え
ln -s /etc/nginx/sites-available/cue /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 8-3. HTTPS（Let's Encrypt 無料）
```bash
certbot --nginx -d 【あなたのドメイン】 -d www.【あなたのドメイン】
```
証明書は自動更新。

---

## STEP 9. Supabase に新ドメインを登録（←ログインに必須）

ブラウザで Supabase ダッシュボード：
- **Authentication → URL Configuration**
  - **Site URL** = `https://【新ドメイン】`
  - **Redirect URLs** に `https://【新ドメイン】/auth/callback` と `https://【新ドメイン】/**` を追加

これをやらないと **Google ログインが失敗する**。

---

## STEP 10. Cron 登録

```bash
crontab -e
```
`移行データ/crontab.txt` の中身を貼り、**ドメイン**と**CRON_SECRET**を書き換える。
STEP3 でタイムゾーンを Asia/Tokyo にした場合は、crontab.txt のコメントに従って
**日本時間に読み替える**（通知 9:00/19:00、収集 3:00）。

---

## STEP 11. 動作確認

`移行手順.md` の「6. 動作確認チェックリスト」を上から確認。
特に **ログイン**（STEP9のミスが出やすい）と **写真アップロード**（Nginxの35m）。

---

## 運用メモ（Xserver VPS）

- **再起動しても自動復帰**: `docker compose` は `restart: unless-stopped` 設定済み。Docker自体の自動起動は `systemctl enable docker`。
- **更新デプロイ**: コードを直したら
  ```bash
  cd /opt/cue && git pull && docker compose up -d --build
  ```
- **メモリ不足でビルドが落ちる時**: スワップを足す
  ```bash
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ```
- **ログ**: `docker compose logs -f` / Cronは `/var/log/cue-cron.log`
