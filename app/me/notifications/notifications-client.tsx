"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  removeSubscription,
  saveSubscription,
  sendTestNotification,
  updatePreferences,
  type NotificationPrefs,
} from "./actions";

type Props = {
  vapidPublicKey: string;
  initialPrefs: NotificationPrefs;
  hasSubscription: boolean;
};

type Status = { kind: "idle" } | { kind: "info" | "error"; msg: string };

// useSyncExternalStore で「mount 済みか」を判定するための noop サブスクライブ
const subscribeNoop = () => () => {};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationsClient({
  vapidPublicKey,
  initialPrefs,
  hasSubscription,
}: Props) {
  // SSR は false → mount 後にブラウザ判定で再評価 (Hydration-safe)
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [subscribed, setSubscribed] = useState(hasSubscription);
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const supported =
    mounted &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // iOS 判定 (iPadOS は Mac を偽装するので touch も見る)
  const isIOS =
    mounted &&
    typeof navigator !== "undefined" &&
    (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const isStandalone =
    mounted &&
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari 独自の standalone フラグ
      (window.navigator as { standalone?: boolean }).standalone === true);

  async function ensureSwReady() {
    if (!("serviceWorker" in navigator)) throw new Error("SWが使えません");
    const reg = await navigator.serviceWorker.ready;
    return reg;
  }

  async function subscribe() {
    setStatus({ kind: "idle" });
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setStatus({ kind: "error", msg: "通知が許可されませんでした" });
        return;
      }
      const reg = await ensureSwReady();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const res = await saveSubscription(
        {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
        navigator.userAgent
      );
      if (!res.ok) {
        setStatus({ kind: "error", msg: res.error ?? "保存に失敗" });
        return;
      }
      setSubscribed(true);
      setStatus({ kind: "info", msg: "通知をオンにしました" });
    } catch (e) {
      setStatus({
        kind: "error",
        msg: e instanceof Error ? e.message : "登録に失敗",
      });
    }
  }

  async function unsubscribe() {
    setStatus({ kind: "idle" });
    try {
      const reg = await ensureSwReady();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setStatus({ kind: "info", msg: "通知をオフにしました" });
    } catch (e) {
      setStatus({
        kind: "error",
        msg: e instanceof Error ? e.message : "解除に失敗",
      });
    }
  }

  async function test() {
    setStatus({ kind: "idle" });
    const res = await sendTestNotification();
    if (!res.ok) {
      setStatus({ kind: "error", msg: res.error ?? "送信失敗" });
    } else {
      setStatus({
        kind: "info",
        msg: `${res.count} 件の端末に送信しました`,
      });
    }
  }

  function togglePref(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    startTransition(async () => {
      const res = await updatePreferences(next);
      if (!res.ok) {
        setStatus({ kind: "error", msg: res.error ?? "保存失敗" });
        setPrefs(prefs);
      }
    });
  }

  if (!supported) {
    // iOS かつ未インストール (Safari 直開き) の場合は具体的な手順を案内
    if (isIOS && !isStandalone) {
      return (
        <div className="rounded-lg border border-border bg-card p-6 text-sm">
          <p className="font-medium">📱 iPhone / iPad で通知を受け取るには</p>
          <p className="mt-2 text-muted-foreground">
            iOS では「ホーム画面に追加」したアプリ (PWA) からのみ通知を受け取れます
            (iOS 16.4 以降が必要)。次の手順で追加してください。
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              Safari 下部の <span className="font-medium text-foreground">共有ボタン</span>{" "}
              (□から↑) をタップ
            </li>
            <li>
              <span className="font-medium text-foreground">
                「ホーム画面に追加」
              </span>{" "}
              を選ぶ
            </li>
            <li>
              追加された Cue アイコンから開き直し、この画面で
              <span className="font-medium text-foreground">「通知をオン」</span>
            </li>
          </ol>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        このブラウザは Web 通知に対応していません。iOS の場合は Safari でホーム画面に追加 (PWA) した後にお試しください。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 状態と購読 */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">この端末の通知</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              許可:{" "}
              <span className="font-medium text-foreground">
                {permission === "granted"
                  ? "オン"
                  : permission === "denied"
                    ? "ブロック"
                    : "未設定"}
              </span>
              {" / 購読: "}
              <span className="font-medium text-foreground">
                {subscribed ? "登録済み" : "未登録"}
              </span>
            </p>
          </div>
          {subscribed ? (
            <Button variant="outline" onClick={unsubscribe}>
              通知をオフ
            </Button>
          ) : (
            <Button onClick={subscribe}>通知をオン</Button>
          )}
        </div>

        {permission === "denied" && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            ブラウザ側で通知がブロックされています。サイト設定から許可してください。
          </p>
        )}

        {subscribed && (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={test}>
              テスト通知を送る
            </Button>
          </div>
        )}
      </div>

      {/* 種別設定 */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">通知の種類</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          オフにした種類は通知されません。
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-border">
          <PrefRow
            label="開催前リマインダー (前日夜)"
            description="行きたい登録したイベントの開催前夜にお知らせ。"
            checked={prefs.notify_reminder_eve}
            disabled={pending}
            onToggle={() => togglePref("notify_reminder_eve")}
          />
          <PrefRow
            label="当日リマインダー (朝)"
            description="行きたい登録したイベント当日の朝にお知らせ。"
            checked={prefs.notify_reminder_morning}
            disabled={pending}
            onToggle={() => togglePref("notify_reminder_morning")}
          />
          <PrefRow
            label="チケット発売通知"
            description="チケット発売の 24 時間前 / 1 時間前 / 発売時にお知らせ。"
            checked={prefs.notify_ticket}
            disabled={pending}
            onToggle={() => togglePref("notify_ticket")}
          />
          <PrefRow
            label="興味マッチ新着 (週1)"
            description="設定した興味タグに合う新着イベントを週1でまとめてお知らせ。"
            checked={prefs.notify_interest_weekly}
            disabled={pending}
            onToggle={() => togglePref("notify_interest_weekly")}
          />
        </ul>
      </div>

      {status.kind !== "idle" && (
        <p
          className={
            "rounded-md px-3 py-2 text-sm " +
            (status.kind === "error"
              ? "bg-red-500/10 text-red-600"
              : "bg-emerald-500/10 text-emerald-600")
          }
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}

function PrefRow({
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 " +
          (checked ? "bg-foreground" : "bg-muted")
        }
      >
        <span
          className={
            "inline-block size-5 transform rounded-full bg-background transition-transform " +
            (checked ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </li>
  );
}
