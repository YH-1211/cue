"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PARENT_CATEGORIES,
  PARENT_LABELS,
  type ParentCategory,
} from "@/lib/events";
import { AREAS_BY_PREFECTURE, PREFECTURES } from "@/lib/tokyo-areas";
import { completeOnboarding, skipOnboarding } from "./actions";

const TOTAL_STEPS = 3;

type Props = {
  initialCategories: string[];
  initialHomeArea: string | null;
};

export function OnboardingWizard({
  initialCategories,
  initialHomeArea,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [homeArea, setHomeArea] = useState(initialHomeArea ?? "");
  const [notifyNearby, setNotifyNearby] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggleCategory(c: ParentCategory) {
    setCategories((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    );
  }

  function finish() {
    setError(null);
    start(async () => {
      const res = await completeOnboarding({
        categories,
        homeArea: homeArea || null,
        notifyNearby,
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(res.error ?? "保存に失敗しました");
      }
    });
  }

  function skip() {
    start(async () => {
      await skipOnboarding();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col px-4 py-10 sm:px-6">
      {/* 進捗 */}
      <div className="mb-8 flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              n <= step ? "bg-foreground" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* STEP 1: 興味カテゴリ */}
      {step === 1 && (
        <div className="flex flex-1 flex-col">
          <h1 className="text-2xl font-bold tracking-tight">
            どんなイベントが好き？
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            気になるジャンルを選んでね。ホームやおすすめで優先表示されます。
            <br />
            (あとから変更できます)
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {PARENT_CATEGORIES.map((c) => {
              const active = categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  )}
                >
                  {PARENT_LABELS[c]}
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex items-center justify-between pt-8">
            <button
              type="button"
              onClick={skip}
              disabled={pending}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              スキップ
            </button>
            <Button onClick={() => setStep(2)}>次へ</Button>
          </div>
        </div>
      )}

      {/* STEP 2: 自宅エリア */}
      {step === 2 && (
        <div className="flex flex-1 flex-col">
          <h1 className="text-2xl font-bold tracking-tight">
            よく行くエリアは？
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            設定すると、そのエリアの周辺で開かれるイベントを近い順に探せます。
            <br />
            位置情報はサーバーに送信されません (エリア名のみ)。
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <label className="text-sm font-medium">エリア</label>
            <Select
              value={homeArea}
              onChange={(e) => setHomeArea(e.target.value)}
            >
              <option value="">(あとで設定する)</option>
              {PREFECTURES.map((pref) => (
                <optgroup key={pref} label={pref}>
                  {Object.keys(AREAS_BY_PREFECTURE[pref]).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <div className="mt-auto flex items-center justify-between pt-8">
            <Button variant="outline" onClick={() => setStep(1)}>
              戻る
            </Button>
            <Button onClick={() => setStep(3)}>次へ</Button>
          </div>
        </div>
      )}

      {/* STEP 3: 通知 */}
      {step === 3 && (
        <div className="flex flex-1 flex-col">
          <h1 className="text-2xl font-bold tracking-tight">
            新着を見逃さない
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            興味に合う新着イベントを、ホームエリア周辺からお知らせします。
          </p>

          <label
            className={cn(
              "mt-6 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
              homeArea
                ? "border-border bg-card"
                : "border-dashed border-border opacity-60"
            )}
          >
            <input
              type="checkbox"
              checked={notifyNearby && !!homeArea}
              disabled={!homeArea}
              onChange={(e) => setNotifyNearby(e.target.checked)}
              className="mt-0.5 size-4 accent-foreground"
            />
            <span className="text-sm">
              <span className="font-medium">近隣マッチ通知を受け取る</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {homeArea
                  ? `${homeArea}区の周辺で開かれる、興味に合うイベントを毎朝まとめて通知します。`
                  : "エリアを設定すると有効にできます (ステップ2)。"}
              </span>
            </span>
          </label>

          {error && (
            <p className="mt-4 text-sm text-red-500">{error}</p>
          )}

          <div className="mt-auto flex items-center justify-between pt-8">
            <Button variant="outline" onClick={() => setStep(2)} disabled={pending}>
              戻る
            </Button>
            <Button onClick={finish} disabled={pending}>
              {pending ? "保存中…" : "はじめる"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
