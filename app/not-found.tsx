import Link from "next/link";

import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex min-h-[60dvh] flex-col justify-center">
        <h1 className="text-2xl font-bold">Halaman nggak ketemu</h1>
        <p className="mt-2 max-w-[34ch] text-[15px] leading-6 text-muted-foreground">
          Ride ini mungkin udah dihapus di Strava, atau link-nya salah.
        </p>
        <Link
          href="/activities"
          className="mt-6 inline-flex h-11 w-fit items-center rounded-md bg-brand px-4 text-sm font-semibold text-background"
        >
          Lihat semua ride
        </Link>
      </div>
    </AppShell>
  );
}
