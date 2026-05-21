import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = { title: "ログイン" };

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 既にログイン済みならマイページへ
  if (user) {
    redirect("/me");
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">ログイン</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          メールでログインリンクを受け取ります。
        </p>
      </header>
      <LoginForm />
    </div>
  );
}
