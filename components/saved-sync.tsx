"use client";

import { useEffect, useRef } from "react";
import { clearLocalSaved, getLocalSavedIds } from "@/lib/saved-local";
import { mergeLocalSaves } from "@/app/me/saved/actions";

// 未ログイン中に端末へ貯めた「行きたい」を、ログインを検知した時点で
// アカウントへ移して localStorage を空にする。レイアウトに1つだけ置く。
export function SavedSync({ loggedIn }: { loggedIn: boolean }) {
  const ran = useRef(false);

  useEffect(() => {
    if (!loggedIn || ran.current) return;
    const ids = getLocalSavedIds();
    if (ids.length === 0) return;
    ran.current = true;
    mergeLocalSaves(ids)
      .then(() => clearLocalSaved())
      .catch(() => {
        // 失敗しても端末側は消さない。次回の表示でまた試す。
        ran.current = false;
      });
  }, [loggedIn]);

  return null;
}
