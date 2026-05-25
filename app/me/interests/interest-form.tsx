"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveInterests, type InterestState } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { CATEGORY_LABELS, EVENT_CATEGORIES } from "@/lib/events";

const initialState: InterestState = { status: "idle" };

export function InterestForm({
  initialSelected,
}: {
  initialSelected: string[];
}) {
  const [state, formAction, pending] = useActionState(
    saveInterests,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-3 text-sm text-muted-foreground">
          気になるカテゴリを選んでください (複数選択可)
        </legend>
        {EVENT_CATEGORIES.map((c) => {
          const checked = initialSelected.includes(c);
          return (
            <label
              key={c}
              className="cursor-pointer select-none rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-muted has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background"
            >
              <input
                type="checkbox"
                name="category"
                value={c}
                defaultChecked={checked}
                className="sr-only"
              />
              {CATEGORY_LABELS[c]}
            </label>
          );
        })}
      </fieldset>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          保存しました ({state.count} 件)
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : "保存"}
        </Button>
        <Link
          href="/me"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          マイページに戻る
        </Link>
      </div>
    </form>
  );
}
