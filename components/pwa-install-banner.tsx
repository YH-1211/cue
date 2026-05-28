"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Chrome/Edge/Android: beforeinstallprompt を捕まえてカスタムボタンに繋ぐ
// iOS Safari: 非対応なので「ホーム画面に追加」の手順を表示
// 既に standalone or 直近7日以内に閉じたら表示しない

type Mode = "android" | "ios" | null;
const DISMISS_KEY = "cue:pwaPromptDismissedAt";
const DISMISS_DAYS = 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PWAInstallBanner() {
  const [mode, setMode] = useState<Mode>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS 用 (5秒遅延 — 初期表示の邪魔を避ける)
    let iosTimer: ReturnType<typeof setTimeout> | null = null;
    if (isIos()) {
      iosTimer = setTimeout(() => setMode("ios"), 5000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setMode(null);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setMode(null);
    } else {
      dismiss();
    }
  };

  if (mode === null) return null;

  return (
    <div
      role="dialog"
      aria-label="アプリのインストール"
      className="fixed inset-x-0 z-50 mx-auto max-w-md px-4"
      // ボトムナビ (h-16) の上に表示
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 72px)",
      }}
    >
      <div className="rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt=""
            className="size-10 shrink-0 rounded-lg"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm font-semibold">Cue をアプリとして追加</p>
            {mode === "android" ? (
              <p className="text-xs text-muted-foreground">
                ホーム画面に追加すると、起動が速くなり通知も受け取れます。
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Safari の <span aria-hidden>共有 ⬆</span>{" "}
                ボタンから「ホーム画面に追加」を選択。
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            あとで
          </Button>
          {mode === "android" && (
            <Button size="sm" onClick={install}>
              追加する
            </Button>
          )}
          {mode === "ios" && (
            <Button size="sm" onClick={dismiss}>
              わかった
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
