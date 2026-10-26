"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Creates the default service schedule (counted from the current odometer). */
export function SeedTasksButton() {
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleClick() {
    setFailed(false);
    const res = await fetch("/api/gear/seed", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setFailed(true);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="mt-4 inline-flex h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-background disabled:opacity-60"
      >
        {isPending ? "Nyiapin…" : "Pasang jadwal default"}
      </button>
      {failed ? (
        <p role="alert" className="mt-2 text-xs text-rest">
          Gagal bikin jadwal. Coba lagi sebentar.
        </p>
      ) : null}
    </div>
  );
}
