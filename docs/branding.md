# Que ブランドガイド

ロゴ・配色の決まりごと。素材を新しく作る時は必ずここを見る。

## 配色

| 用途 | 値 |
|---|---|
| 背景（黒） | `#0A0A0F` |
| 文字（白） | `#FFFFFF` |
| アクセント（オレンジ） | `#F97316` |
| サブテキスト（グレー） | `#B8B8C0` / `#8A8A94` |

## ロゴは2種類

| | ファイル | 使う場面 |
|---|---|---|
| **Q 一文字版** | `public/branding/logo-q.svg` | アプリアイコン、ファビコン、正方形が必要なところ |
| **Que ワードマーク版** | `public/branding/logo-que.svg` | カバー画像、リッチメニュー、横長で名前を見せたいところ |

新しい素材を作る時は、この2つのどちらかをコピーして使うこと。

## ⚠️ 書体は2種とも `SF Pro Display` / `font-weight: 800`

```
font-family="'SF Pro Display', system-ui, sans-serif"
font-weight="800"
```

以前は Q が `SF Pro Display`、Que が `Helvetica Neue` と別の書体だったため、
**同じ `font-weight: 800` を指定しても線の太さが揃わなかった**
（縦ストロークが Q は文字高さの 26.8%、Que は 19.6% で、Que が Q の 73% しかなかった）。

書体を揃えると 26.9% / 26.8% でほぼ一致する。**Que 側だけ別の書体にしないこと。**

## ⚠️ オレンジの点の位置は「座標」で決めない

以前はアセットごとに `cx` / `cy` を目分量で手打ちしていたため、位置もサイズもバラバラになっていた
（縦位置が -9% 〜 +18% の間で割れ、直径にも3割の差があった）。

**必ず「文字の高さ H に対する比率」で計算する。** こうすればどんなサイズで使っても同じ見え方になる。

- `H` = 白い文字の**実測バウンディングボックスの高さ**（`font-size` の値ではない）
- 基準となる文字の右端・上端も、同じく実測 bbox を使う

| | Q 一文字版 | Que ワードマーク版 |
|---|---|---|
| `cx` | 文字の右端 + `0.075 × H` | 文字の右端 + `0.10 × H` |
| `cy` | 文字の上端 + `0.179 × H` | 文字の上端 + `0.00 × H` |
| `r` | `0.107 × H` | `0.12 × H` |

書体や字数を変えると bbox が動くので、**そのたびに測り直してドットを置き直すこと。**

各 SVG にもこの比率をコメントで書いてある。編集する時は消さないこと。

## 派生アセット一覧

SVG が原本。PNG は SVG から書き出したもの（sharp を使用）。
**SVG を直したら、対応する PNG も必ず書き出し直す。**

| PNG | サイズ | 元の SVG | 反映先 |
|---|---|---|---|
| `public/branding/line-profile.png` | 1024×1024 | `line-profile.svg` | LINE プロフィール画像（手動アップ） |
| `public/branding/line-cover.png` | 1080×878 | `line-cover.svg` | LINE 背景画像（手動アップ） |
| `public/branding/rm-c2.png` | 2500×1686 | `rm-c2.svg` | LINE リッチメニュー（API で差し替え） |
| `public/icon-192.png` / `icon-512.png` / `apple-icon.png` | 各種 | `public/icon.svg` | PWA・ホーム画面 |
| `app/favicon.ico` | 16+32 | `public/icon.svg` | ブラウザのタブ |

※ `public/icon.svg` は Q 一文字版の比率ルールの**基準そのもの**なので、すでに一致している（作り直し不要）。

## PNG の書き出し方

`sharp` を使う。**スクリプトはプロジェクト直下に置いて実行すること**
（`/tmp` から実行すると `node_modules` を解決できずコケる）。

```js
import sharp from "sharp";
import { readFileSync } from "fs";

await sharp(readFileSync("public/branding/line-cover.svg"), { density: 300 })
  .resize(1080, 878)
  .png({ compressionLevel: 9 })
  .toFile("public/branding/line-cover.png");
```

## LINE への反映方法

| 対象 | 方法 |
|---|---|
| プロフィール画像 | LINE Official Account Manager で**手動アップ**（API 不可） |
| 背景 / カバー画像 | LINE Official Account Manager で**手動アップ**（API 不可） |
| リッチメニュー | Messaging API。ただし**既存メニューは編集できない**ので毎回作り直す |

リッチメニューの差し替え手順（画像やリンク先を変えたい時は毎回これ）:

1. `POST /v2/bot/richmenu` — 新しいメニューを作る
2. `POST https://api-data.line.me/v2/bot/richmenu/{id}/content` — 画像をアップ（`Content-Type: image/png`、1MB 以内）
3. `POST /v2/bot/user/all/richmenu/{id}` — 全ユーザーのデフォルトに設定
4. `DELETE /v2/bot/richmenu/{旧id}` — 古いのを消す
