import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ContactForm } from "./contact-form";

export const metadata = { title: "お問い合わせ" };

export default async function ContactPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultName = "";
  const defaultEmail = user?.email ?? "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    defaultName = profile?.display_name ?? "";
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          ← ホームに戻る
        </Link>
      </nav>

      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">お問い合わせ</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          不具合のご報告、機能のご要望、その他お気づきの点がありましたら、こちらのフォームからお寄せください。
        </p>
      </header>

      <ContactForm defaultName={defaultName} defaultEmail={defaultEmail} />
    </div>
  );
}
