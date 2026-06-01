"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveInterests, type InterestState } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  PARENT_CATEGORIES,
  PARENT_LABELS,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
} from "@/lib/events";

const initialState: InterestState = { status: "idle" };

function Chip({
  value,
  label,
  checked,
}: {
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="cursor-pointer select-none rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background">
      <input
        type="checkbox"
        name="category"
        value={value}
        defaultChecked={checked}
        className="sr-only"
      />
      {label}
    </label>
  );
}

export function InterestForm({
  initialSelected,
}: {
  initialSelected: string[];
}) {
  const [state, formAction, pending] = useActionState(
    saveInterests,
    initialState
  );
  const sel = new Set(initialSelected);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        気になるカテゴリを選んでください (複数選択可)。大きなジャンルでも、
        細かいサブジャンルでも選べます。
      </p>

      <div className="flex flex-col gap-5">
        {PARENT_CATEGORIES.map((parent) => (
          <fieldset key={parent} className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-muted-foreground">
              {PARENT_LABELS[parent]}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                value={parent}
                label={`${PARENT_LABELS[parent]} (すべて)`}
                checked={sel.has(parent)}
              />
              {SUBCATEGORIES[parent].map((sub) => (
                <Chip
                  key={sub}
                  value={sub}
                  label={SUBCATEGORY_LABELS[sub]}
                  checked={sel.has(sub)}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

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
