"use client";

import { useState, useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

export function MarkDoneButton({ taskId }: { taskId: number }) {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleClick() {
    setDone(true);
    await fetch("/api/gear/done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending || done}
      className={cn(
        "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        done
          ? "bg-pine/10 text-pine cursor-default"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        isPending && "opacity-50"
      )}
    >
      <CheckCheck className="size-3" aria-hidden />
      {done ? "Done!" : "Mark done"}
    </button>
  );
}
