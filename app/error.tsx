"use client";

import { useEffect } from "react";

import { AppShell } from "@/components/app-shell";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppShell>
      <div className="flex min-h-[60dvh] flex-col justify-center">
        <h1 className="text-2xl font-bold">Data nggak kebaca</h1>
        <p className="mt-2 max-w-[34ch] text-[15px] leading-6 text-muted-foreground">
          Panel ini gagal ngambil data. Ride lo tetap aman di Strava, cuma tampilannya yang belum bisa dimuat.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-11 w-fit rounded-md bg-brand px-4 text-sm font-semibold text-background"
        >
          Coba lagi
        </button>
      </div>
    </AppShell>
  );
}
