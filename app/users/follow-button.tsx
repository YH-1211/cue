"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "./actions";

type Props = {
  targetId: string;
  initialFollowing: boolean;
};

export function FollowButton({ targetId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next); // 楽観的更新
    start(async () => {
      const res = next
        ? await followUser(targetId)
        : await unfollowUser(targetId);
      if (!res.ok) setFollowing(!next); // 失敗時ロールバック
    });
  }

  return (
    <Button
      size="sm"
      variant={following ? "outline" : "default"}
      onClick={toggle}
      disabled={pending}
    >
      {following ? "フォロー中" : "フォローする"}
    </Button>
  );
}
