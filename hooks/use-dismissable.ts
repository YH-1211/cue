"use client";

import { useEffect, useRef } from "react";

/**
 * 開いているポップアップ (メニュー / 候補リスト) を
 * 外側クリック・Esc キーで閉じるための共通フック。
 *
 * - containerRef: ポップアップ全体を包む要素に付ける
 * - triggerRef: 開閉ボタンに付けると Esc で閉じた後フォーカスが戻る
 */
export function useDismissable<
  T extends HTMLElement = HTMLDivElement,
  Trigger extends HTMLElement = HTMLButtonElement,
>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null);
  const triggerRef = useRef<Trigger>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onCloseRef.current();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { containerRef, triggerRef };
}
