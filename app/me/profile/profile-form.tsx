"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateProfile, type ProfileState } from "./actions";

type Props = {
  initial: {
    display_name: string;
    bio: string;
    avatar_url: string | null;
  };
};

const initialState: ProfileState = { status: "idle" };

export function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState
  );
  const [name, setName] = useState(initial.display_name);
  const [bio, setBio] = useState(initial.bio);
  const [preview, setPreview] = useState<string | null>(initial.avatar_url);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPreview(URL.createObjectURL(f));
  }

  // 保存成功でマイページへ戻す
  if (state.status === "success") {
    router.push("/me");
  }

  const initialLetter = (name || "?").charAt(0).toUpperCase();

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* アバター */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative rounded-full focus:outline-none"
        >
          <Avatar className="size-24 ring-2 ring-border transition group-hover:ring-foreground">
            {preview && <AvatarImage src={preview} alt="" />}
            <AvatarFallback className="text-2xl">{initialLetter}</AvatarFallback>
          </Avatar>
          <span className="absolute inset-x-0 -bottom-1 mx-auto w-fit rounded-full bg-foreground px-2 py-0.5 text-[10px] text-background">
            変更
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          name="avatar"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPick}
          className="hidden"
        />
      </div>

      {/* 表示名 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="display_name">表示名</Label>
        <Input
          id="display_name"
          name="display_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="あなたの名前"
          required
        />
        <p className="text-right text-[10px] text-muted-foreground">
          {name.length}/30
        </p>
      </div>

      {/* 自己紹介 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">自己紹介</Label>
        <textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
          rows={3}
          placeholder="好きなジャンルや、よく行くエリアなど"
          className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="text-right text-[10px] text-muted-foreground">
          {bio.length}/160
        </p>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/me")}
          disabled={pending}
        >
          キャンセル
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "保存中..." : "保存"}
        </Button>
      </div>
    </form>
  );
}
