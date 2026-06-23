import type { Metadata } from "next";
import { Space_Grotesk, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Body / UI — warm, highly readable grotesque
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Display / headings — engineered, slightly mechanical
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

// Numeric / metrics — the signature, always tabular figures
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "pasabersepeda — cycling dashboard",
  description:
    "Personal cycling instrument panel — rides, progression, and bike maintenance, auto-updated from Strava.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        hankenGrotesk.variable,
        spaceGrotesk.variable,
        jetbrainsMono.variable
      )}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
