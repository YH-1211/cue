import Link from "next/link";
import { AppearanceSection } from "./appearance-section";

export const metadata = { title: "表示・テーマ" };

export default function AppearancePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-2 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">表示・テーマ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        背景の明るさとアクセントカラーを、お好みに合わせて変更できます。
      </p>

      <div className="mt-8">
        <AppearanceSection />
      </div>
    </div>
  );
}
