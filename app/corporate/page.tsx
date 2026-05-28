import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "企業情報",
  description:
    "Cue株式会社の企業情報・サービス概要・会社概要をご紹介します。アートや音楽、舞台などのイベント情報を一元化し、日本の文化体験を豊かにします。",
};

const features = [
  {
    title: "イベント一元管理",
    description:
      "アート・音楽・舞台・祭り・季節のイベントを横断的に収集・整理。バラバラになりがちな情報を一か所で確認できます。",
    icon: "📅",
  },
  {
    title: "パーソナライズ推薦",
    description:
      "ユーザーの興味タグと現在地をもとに、最適なイベントをリアルタイムで推薦。行きたい体験がすぐに見つかります。",
    icon: "✨",
  },
  {
    title: "季節カレンダー",
    description:
      "花見・紅葉・夏祭りなど、日本の四季に根ざしたイベントを時系列で把握。季節の楽しみを見逃しません。",
    icon: "🌸",
  },
  {
    title: "プッシュ通知",
    description:
      "お気に入りエリアと興味カテゴリに合ったイベント情報を、タイムリーにプッシュ通知でお届けします。",
    icon: "🔔",
  },
  {
    title: "イベント登録",
    description:
      "主催者はCueにイベント情報を投稿できます。審査を通過した情報のみを掲載し、信頼性の高い情報を提供します。",
    icon: "📝",
  },
  {
    title: "PWA対応",
    description:
      "スマートフォンのホーム画面に追加してネイティブアプリのように利用可能。オフラインでも基本機能を維持します。",
    icon: "📱",
  },
];

const companyInfo = [
  { label: "社名", value: "Cue株式会社" },
  { label: "設立", value: "2024年" },
  { label: "所在地", value: "東京都" },
  { label: "事業内容", value: "イベント情報プラットフォームの開発・運営" },
  { label: "サービス名", value: "Cue（キュー）" },
  { label: "対応地域", value: "日本全国（東京圏を中心に展開中）" },
];

export default function CorporatePage() {
  return (
    <div className="w-full">
      {/* ヒーロー */}
      <section className="relative overflow-hidden bg-foreground text-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-20 sm:py-28 sm:px-6">
          <Badge
            variant="outline"
            className="w-fit border-background/30 text-background/80"
          >
            Corporate
          </Badge>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            日本の「体験」を、
            <br />
            もっと身近に。
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-background/70 sm:text-lg">
            Cueは、アート・音楽・舞台・祭りなど日本各地のイベント情報を一元化し、
            誰もが自分にぴったりの文化体験を見つけられる社会を目指しています。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/events"
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
              })}
            >
              サービスを試す
            </Link>
            <a
              href="#contact"
              className={buttonVariants({
                variant: "ghost",
                size: "lg",
                className: "text-background hover:bg-background/10 hover:text-background",
              })}
            >
              お問い合わせ
            </a>
          </div>
        </div>
      </section>

      {/* ミッション */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Mission
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              「行きたい」を、
              <br />
              見つけやすくする。
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              日本には毎日数え切れないほどのイベントが開催されています。しかしその多くは、
              SNSや各主催者のサイトに散在しており、一般の人々には届きにくいのが現状です。
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              Cueはその情報の断絶を解消し、誰もが「行きたい体験」を簡単に見つけ、
              日本の文化・芸術シーンをより身近に感じられるプラットフォームです。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { number: "1,000+", label: "掲載イベント数" },
              { number: "20+", label: "対応カテゴリ" },
              { number: "全国", label: "対応エリア" },
              { number: "無料", label: "サービス利用" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 rounded-xl border border-border bg-card p-6"
              >
                <span className="text-3xl font-bold tracking-tight">
                  {stat.number}
                </span>
                <span className="text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* サービス特徴 */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-12 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Services
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Cueの主な機能
          </h2>
          <p className="max-w-xl text-base text-muted-foreground">
            利用者とイベント主催者の双方に価値を提供する、
            包括的なイベント情報プラットフォームです。
          </p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
            >
              <span className="text-3xl" aria-hidden="true">
                {feature.icon}
              </span>
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Separator />

      {/* 主催者向け */}
      <section className="bg-muted/40">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                For Organizers
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                イベント主催者の方へ
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                Cueにイベントを掲載することで、あなたのイベントがより多くの人に届きます。
                登録は無料。審査を経て掲載されることで、信頼性の高い情報として配信されます。
              </p>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {[
                  "無料でイベントを掲載",
                  "カテゴリ・エリア別で関心層にリーチ",
                  "プッシュ通知でユーザーに直接配信",
                  "カレンダー・フィード機能で継続露出",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-600" aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <Link
                  href="/events/new"
                  className={buttonVariants({ size: "default" })}
                >
                  イベントを掲載する
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-8">
              <h3 className="text-lg font-semibold">掲載の流れ</h3>
              <ol className="flex flex-col gap-4">
                {[
                  {
                    step: "01",
                    title: "アカウント作成",
                    desc: "メールアドレスで無料登録",
                  },
                  {
                    step: "02",
                    title: "イベント情報を入力",
                    desc: "タイトル・日時・場所・カテゴリを記入",
                  },
                  {
                    step: "03",
                    title: "審査・承認",
                    desc: "運営スタッフが内容を確認し掲載承認",
                  },
                  {
                    step: "04",
                    title: "公開・配信",
                    desc: "Cue上で公開され、関連ユーザーに通知",
                  },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                      {item.step}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.desc}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* 会社概要 */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Company
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            会社概要
          </h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              {companyInfo.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? "bg-muted/30" : "bg-card"}
                >
                  <th className="w-1/3 px-6 py-4 text-left font-medium text-muted-foreground sm:w-1/4">
                    {row.label}
                  </th>
                  <td className="px-6 py-4">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Separator />

      {/* お問い合わせ */}
      <section id="contact" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Contact
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            お問い合わせ
          </h2>
          <p className="max-w-md text-base text-muted-foreground">
            ご質問・ご要望・取材・パートナーシップのご相談など、お気軽にお問い合わせください。
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <a
              href="mailto:contact@cue.jp"
              className={buttonVariants({ size: "lg" })}
            >
              メールで問い合わせる
            </a>
            <Link
              href="/events/new"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              イベントを掲載する
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            返信は通常2〜3営業日以内に行います。
          </p>
        </div>
      </section>
    </div>
  );
}
