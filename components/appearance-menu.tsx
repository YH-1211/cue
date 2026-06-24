"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";
import { saveAppearance } from "@/app/settings/appearance/actions";

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

const THEMES: { id: Theme; label: string }[] = [
  { id: "light", label: "ライト" },
  { id: "dark", label: "ダーク" },
  { id: "system", label: "端末に合わせる" },
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

export function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [accent, setAccent] = useState<Accent>("violet");
  const ref = useRef<HTMLDivElement>(null);

  // マウント後に現在の保存値を読み込む (SSR とズレないよう初期値は固定)
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

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="表示テーマ"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Palette className="size-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            背景
          </p>
          <div className="mb-3 inline-flex w-full rounded-md border border-border p-0.5 text-xs">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => chooseTheme(t.id)}
                className={
                  "flex-1 rounded px-2 py-1.5 transition-colors " +
                  (theme === t.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            アクセント
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => chooseAccent(a.id)}
                aria-label={a.label}
                title={a.label}
                className="flex aspect-square items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-[box-shadow] hover:ring-2 hover:ring-border"
                style={{ background: a.color }}
              >
                {accent === a.id && (
                  <Check className="size-4 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
