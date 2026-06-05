import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata = { title: "利用規約" };

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          ← ホームに戻る
        </Link>
      </nav>

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">利用規約</h1>
          <p className="text-sm text-muted-foreground">
            制定日：{SITE.effectiveDate}
          </p>
        </header>

        <p className="text-sm leading-relaxed">
          本利用規約（以下「本規約」といいます）は、{SITE.operator}
          （以下「当方」といいます）が提供する{SITE.name}
          （以下「本サービス」といいます）の利用条件を定めるものです。利用者は、本規約に同意のうえ本サービスを利用するものとします。
        </p>

        <Section title="第1条（適用）">
          本規約は、本サービスの利用に関する当方と利用者との間の一切の関係に適用されます。
        </Section>

        <Section title="第2条（利用登録）">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              利用者は、本規約に同意し、当方の定める方法によって利用登録を行うものとします。
            </li>
            <li>
              当方は、登録希望者に一定の事由があると判断した場合、登録を承認しないことがあります。
            </li>
            <li>
              利用者は、登録情報を自己の責任で正確かつ最新の状態に保つものとします。
            </li>
          </ul>
        </Section>

        <Section title="第3条（アカウントの管理）">
          利用者は、自己の責任においてアカウントを管理するものとし、第三者に利用させ、または貸与・譲渡してはなりません。アカウントの不正利用による損害について、当方は責任を負いません。
        </Section>

        <Section title="第4条（投稿コンテンツ）">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              利用者は、イベント情報・感想・写真等（以下「投稿コンテンツ」といいます）を投稿できます。
            </li>
            <li>
              投稿コンテンツの内容について、当方はその正確性・最新性・適法性を保証しません。
            </li>
            <li>
              利用者は、投稿コンテンツについて必要な権利を有していること、第三者の権利を侵害しないことを保証するものとします。
            </li>
            <li>
              利用者は、当方が本サービスの提供・改善・宣伝のために投稿コンテンツを必要な範囲で利用（複製・表示等）することを許諾するものとします。
            </li>
          </ul>
        </Section>

        <Section title="第5条（禁止事項）">
          利用者は、本サービスの利用にあたり、次の行為をしてはなりません。
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>
              第三者の知的財産権、肖像権、プライバシー、名誉その他の権利・利益を侵害する行為
            </li>
            <li>虚偽の情報や、実在しない・誤解を招くイベント情報を投稿する行為</li>
            <li>
              わいせつ、差別的、暴力的、その他不適切な内容を投稿・送信する行為
            </li>
            <li>他の利用者への迷惑行為、誹謗中傷、嫌がらせ</li>
            <li>本サービスの運営を妨害する行為、不正アクセス行為</li>
            <li>営業・宣伝・勧誘を目的とした無断利用（当方が許可する場合を除く）</li>
            <li>その他、当方が不適切と判断する行為</li>
          </ul>
        </Section>

        <Section title="第6条（不適切な投稿の報告）">
          利用者は、本サービス上に不適切な投稿や権利侵害を発見した場合、
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {SITE.contactEmail}
          </a>
          まで報告できます。当方は、報告の内容を確認し、必要と判断した場合、対象の投稿を削除する等の措置を講じることがあります。
        </Section>

        <Section title="第7条（投稿の削除・利用制限）">
          当方は、利用者が本規約に違反した場合、または違反のおそれがあると判断した場合、事前の通知なく、投稿コンテンツの削除、アカウントの利用制限・停止等の措置を講じることができます。
        </Section>

        <Section title="第8条（本サービスの提供の停止・変更）">
          当方は、システムの保守、不可抗力、その他やむを得ない事由がある場合、利用者への事前の通知なく、本サービスの全部または一部の提供を停止・中断・変更できるものとします。これにより利用者に生じた損害について、当方は責任を負いません。
        </Section>

        <Section title="第9条（免責事項）">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              本サービスに掲載されるイベント情報（日時・場所・料金・チケット等）は変更・中止される場合があります。利用者は、参加前に必ず主催者・公式情報をご確認ください。
            </li>
            <li>
              当方は、本サービスに事実上または法律上の瑕疵がないことを保証しません。
            </li>
            <li>
              当方は、本サービスの利用または利用できなかったことにより利用者に生じた損害について、当方の故意または重過失による場合を除き、責任を負いません。
            </li>
          </ul>
        </Section>

        <Section title="第10条（本規約の変更）">
          当方は、必要と判断した場合、利用者への通知をもって本規約を変更できるものとします。変更後に利用者が本サービスを利用した場合、変更後の本規約に同意したものとみなします。
        </Section>

        <Section title="第11条（準拠法・管轄）">
          本規約の解釈・適用は日本法に準拠します。本サービスに関して紛争が生じた場合、当方の所在地を管轄する裁判所を専属的合意管轄とします。
        </Section>

        <Section title="第12条（お問い合わせ）">
          本規約に関するお問い合わせは、以下までご連絡ください。
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
