"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

/** Records a task as done at the bike's current odometer, then refreshes. */
export function MarkDoneButton({ taskId, label }: { taskId: number; label: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleClick() {
    setState("saving");
    const res = await fetch("/api/gear/done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    }).catch(() => null);
    if (!res?.ok) {
      setState("error");
      return;
    }
    setState("done");
    startTransition(() => router.refresh());
  }

  const busy = state === "saving" || isPending;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || state === "done"}
        className={cn(
          "h-11 w-full rounded-md border text-sm font-medium",
          state === "done" ? "border-ok/40 text-ok" : "border-line hover:bg-raised",
          busy && "opacity-60"
        )}
      >
        {state === "done" ? "Tercatat" : busy ? "Nyimpen…" : "Tandai udah dikerjain"}
      </button>
      <p role="status" className="sr-only">
        {state === "done" ? `${label} dicatat di odometer sekarang` : ""}
      </p>
      {state === "error" ? (
        <p role="alert" className="mt-2 text-xs text-rest">
          Gagal nyimpen. Cek koneksi, terus coba lagi.
        </p>
      ) : null}
    </div>
  );
}
