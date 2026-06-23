"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, TrendingUp, ShieldCheck, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/planner", label: "Planner", icon: ShieldCheck },
  { href: "/gear", label: "Gear", icon: Wrench },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-heading text-base font-semibold tracking-tight">
              pasabersepeda
            </span>
            <span className="label-readout hidden sm:inline">cycling panel</span>
          </Link>

          <nav className="flex items-center gap-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "text-pine font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-xs text-muted-foreground">
            Personal panel · data from Strava
          </span>
          <span className="label-readout">single rider</span>
        </div>
      </footer>
    </div>
  );
}
