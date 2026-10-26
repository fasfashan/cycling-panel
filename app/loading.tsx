import { AppShell } from "@/components/app-shell";

export default function Loading() {
  return (
    <AppShell>
      <p role="status" className="text-sm text-muted-foreground">
        Ngambil data ride dari database…
      </p>
      <div className="mt-4 space-y-3" aria-hidden>
        <div className="h-8 w-3/4 animate-pulse rounded bg-surface motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
          <div className="h-28 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
        </div>
      </div>
    </AppShell>
  );
}
