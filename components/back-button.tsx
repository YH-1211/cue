"use client";

import { useRouter } from "next/navigation";

type Props = {
  /** 戻り先の履歴が無いときに遷移するパス */
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export function BackButton({
  fallbackHref = "/",
  label = "戻る",
  className,
}: Props) {
  const router = useRouter();

  function onBack() {
    // 同一サイト内に戻り履歴があればブラウザバック、無ければフォールバック先へ
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={onBack}
      className={
        className ??
        "text-sm text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      ← {label}
    </button>
  );
}
