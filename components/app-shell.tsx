"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Hand-drawn square-cap glyphs (not a stock icon set); the label carries the meaning.
const nav = [
  {
    href: "/",
    label: "Hari ini",
    icon: (
      <>
        <path d="M5 5h14v14H5z" />
        <path d="M5 9h14" />
        <circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
  { href: "/activities", label: "Rides", icon: <path d="M5 7h14M5 12h14M5 17h9" /> },
  { href: "/trends", label: "Progres", icon: <path d="M5 19V13M10 19V9M15 19V11M20 19V5" /> },
  {
    href: "/gear",
    label: "Garasi",
    icon: (
      <>
        <circle cx="7" cy="15" r="3.5" />
        <circle cx="17" cy="15" r="3.5" />
        <path d="M7 15l4-6h5l1 6M11 9l-1-2H8" />
      </>
    ),
  },
];

/**
 * Mobile-only frame: one column capped at phone width, centered on desktop,
 * with a fixed bottom nav. Content reserves the nav height + safe area.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-background/95 px-4 backdrop-blur">
        <Link href="/" className="font-heading text-[17px] font-semibold tracking-tight">
          Pasa Bersepeda
        </Link>
      </header>

      <main className="view-enter px-4 pb-[calc(64px+24px+env(safe-area-inset-bottom))] pt-5">
        {children}
      </main>

      <nav
        aria-label="Navigasi utama"
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="grid h-16 grid-cols-4">
          {nav.map(({ href, label, icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 text-[11px]",
                    active ? "font-semibold text-brand" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="square"
                    aria-hidden
                  >
                    {icon}
                  </svg>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
