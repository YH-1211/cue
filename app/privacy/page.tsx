import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          ← ホームに戻る
        </Link>
      </nav>

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            プライバシーポリシー
          </h1>
          <p className="text-sm text-muted-foreground">
            制定日：{SITE.effectiveDate}
          </p>
        </header>

        <p className="text-sm leading-relaxed">
          {SITE.operator}（以下「当方」といいます）は、{SITE.name}
          （以下「本サービス」といいます）における利用者の個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
        </p>

        <Section title="1. 取得する情報">
          本サービスは、提供にあたり次の情報を取得します。
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>アカウント情報</strong>
              ：メールアドレス、Googleアカウントによるログイン時に提供されるプロフィール情報（表示名、アイコン画像等）。
            </li>
            <li>
              <strong>プロフィール情報</strong>
              ：利用者が登録する表示名、自己紹介、興味のあるカテゴリ、活動エリア等。
            </li>
            <li>
              <strong>位置情報</strong>
              ：周辺のイベント表示や通知のために、利用者の同意に基づき取得する現在地情報。端末の設定からいつでも無効にできます。
            </li>
            <li>
              <strong>投稿コンテンツ</strong>
              ：利用者が投稿するイベント情報、感想、写真、評価等。
            </li>
            <li>
              <strong>通知設定・購読情報</strong>
              ：プッシュ通知を許可した場合の購読情報（端末ごとのトークン等）。
            </li>
            <li>
              <strong>利用状況</strong>
              ：保存したイベント、フォロー、参加記録などサービス利用に伴い生成される情報。
            </li>
          </ul>
        </Section>

        <Section title="2. 利用目的">
          取得した情報は、次の目的で利用します。
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>本サービスの提供、本人確認、ログイン認証のため</li>
            <li>
              利用者の興味・位置情報に基づくイベントの表示・レコメンド・通知のため
            </li>
            <li>投稿コンテンツの公開・共有機能の提供のため</li>
            <li>お問い合わせ対応、不適切な利用の防止・対応のため</li>
            <li>本サービスの改善、新機能の開発のため</li>
          </ul>
        </Section>

        <Section title="3. 位置情報の取扱い">
          位置情報は、利用者が端末・ブラウザで許可した場合にのみ取得し、周辺イベントの表示や通知の最適化に利用します。常時追跡は行いません。許可は端末・ブラウザの設定からいつでも取り消すことができます。
        </Section>

        <Section title="4. プッシュ通知">
          利用者がプッシュ通知を許可した場合、イベントのリマインドやおすすめのお知らせを送信することがあります。通知は、本サービスの通知設定または端末の設定からいつでも停止できます。
        </Section>

        <Section title="5. 第三者提供・外部サービスの利用">
          当方は、法令に基づく場合を除き、利用者の同意なく個人情報を第三者に提供しません。ただし、本サービスの提供のため、以下の外部サービスを利用しており、これらに情報の処理を委託しています。
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase</strong>
              （データベース・認証基盤）：アカウント情報、投稿、利用データの保管。
            </li>
            <li>
              <strong>Google</strong>
              （Googleログインを利用する場合）：認証情報の連携。
            </li>
          </ul>
          各サービスの情報の取扱いについては、それぞれの提供事業者のプライバシーポリシーをご確認ください。
        </Section>

        <Section title="6. 投稿コンテンツの公開">
          利用者が投稿したイベント情報・感想・写真等は、本サービス上で他の利用者に公開されます。公開を希望しない情報は投稿しないでください。投稿の削除を希望する場合は、お問い合わせください。
        </Section>

        <Section title="7. 安全管理">
          当方は、取得した個人情報の漏えい、滅失またはき損の防止その他の安全管理のために、必要かつ適切な措置を講じます。
        </Section>

        <Section title="8. 開示・訂正・削除等の請求">
          利用者は、自己の個人情報について、開示・訂正・利用停止・削除を請求できます。ご希望の場合は、末尾のお問い合わせ先までご連絡ください。アカウントおよび関連データの削除についても同様に対応します。
        </Section>

        <Section title="9. 本ポリシーの変更">
          当方は、必要に応じて本ポリシーを変更することがあります。重要な変更を行う場合は、本サービス上で告知します。変更後の本ポリシーは、本サービスに掲載した時点から効力を生じます。
        </Section>

        <Section title="10. お問い合わせ窓口">
          本ポリシーに関するお問い合わせ、個人情報の取扱いに関するご請求は、以下までご連絡ください。
          <div className="mt-2 rounded-md border border-border p-4 text-sm">
            <p>{SITE.operator}</p>
            <p>
              メール：
              <a
                href={`mailto:${SITE.contactEmail}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {SITE.contactEmail}
              </a>
            </p>
          </div>
        </Section>
      </article>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
