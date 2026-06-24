"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { saveAppearance } from "./actions";

type Theme = "light" | "dark" | "system";
type Accent = "violet" | "orange" | "blue" | "teal" | "pink" | "green";

const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: "violet", label: "バイオレット", color: "oklch(0.58 0.2 295)" },
  { id: "orange", label: "オレンジ", color: "oklch(0.66 0.17 50)" },
  { id: "blue", label: "ブルー", color: "oklch(0.58 0.17 250)" },
  { id: "teal", label: "ティール", color: "oklch(0.62 0.12 185)" },
  { id: "pink", label: "ピンク", color: "oklch(0.62 0.22 0)" },
  { id: "green", label: "グリーン", color: "oklch(0.62 0.16 150)" },
];

const THEMES: { id: Theme; label: string; hint: string }[] = [
  { id: "light", label: "ライト", hint: "明るい背景" },
  { id: "dark", label: "ダーク", hint: "暗い背景" },
  { id: "system", label: "端末に合わせる", hint: "OSの設定に追従" },
];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function AppearanceSection() {
  const [theme, setTheme] = useState<Theme>("system");
  const [accent, setAccent] = useState<Accent>("violet");

  useEffect(() => {
    try {
      const t = localStorage.getItem("cue:theme");
      setTheme(t === "light" || t === "dark" ? t : "system");
      const a = localStorage.getItem("cue:accent") as Accent | null;
      if (a && ACCENTS.some((x) => x.id === a)) setAccent(a);
    } catch {
      // ignore
    }
  }, []);

  function chooseTheme(t: Theme) {
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem("cue:theme");
      else localStorage.setItem("cue:theme", t);
    } catch {
      // ignore
    }
    applyTheme(t);
    // ログイン中なら DB にも保存 (端末間同期)。ゲストは server action 側で no-op。
    void saveAppearance(t, accent);
  }

  function chooseAccent(a: Accent) {
    setAccent(a);
    try {
      localStorage.setItem("cue:accent", a);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute("data-accent", a);
    void saveAppearance(theme, a);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">背景</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          画面の明るさを選べます。
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseTheme(t.id)}
              className={
                "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors " +
                (theme === t.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted")
              }
            >
              <span className="flex w-full items-center justify-between text-sm font-medium">
                {t.label}
                {theme === t.id && <Check className="size-4 text-primary" />}
              </span>
              <span className="text-xs text-muted-foreground">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">アクセントカラー</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ボタンやリンク、開催中・おすすめの表示に使う色です。
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => chooseAccent(a.id)}
              className={
                "flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors " +
                (accent === a.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted")
              }
            >
              <span
                className="flex size-9 items-center justify-center rounded-full"
                style={{ background: a.color }}
              >
                {accent === a.id && (
                  <Check className="size-5 text-white drop-shadow" />
                )}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        ※ この設定はこの端末にのみ保存されます。
      </p>
    </div>
  );
}
