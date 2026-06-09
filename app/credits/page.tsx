import Link from "next/link";

export const metadata = { title: "画像クレジット" };

export default function CreditsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          ← ホームに戻る
        </Link>
      </nav>

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">画像クレジット</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            イベント画像が登録されていない場合に表示するカテゴリー別の代替画像には、以下のフリー素材を利用しています。
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Unsplash</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            アート・音楽・スポーツ（野球／サッカー／バスケ／マラソン）・祭り・季節などの代替画像は{" "}
            <a
              href="https://unsplash.com/license"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Unsplash License
            </a>{" "}
            に基づき利用しています（クレジット表記は任意）。
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Wikimedia Commons</h2>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              相撲の代替画像: &quot;Sumo tournament&quot; by Cesar I. Martins —{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:Sumo_tournament_(15528357117).jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                出典
              </a>
              、ライセンス{" "}
              <a
                href="https://creativecommons.org/licenses/by/2.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                CC BY 2.0
              </a>
              （トリミング・リサイズして使用）。
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}
