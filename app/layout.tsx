import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

/*
 * Style guide §3 — Fredoka for display (wordmark, headings, card titles),
 * Nunito for everything else. Loaded through next/font so they are
 * self-hosted rather than fetched from Google at runtime.
 */
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memories",
  description: "Little albums for days worth keeping.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Ambient light behind the glass — style guide §8. App-wide. */}
        <div className="orbs" aria-hidden="true">
          <span className="orb orb-p1" />
          <span className="orb orb-o1" />
          <span className="orb orb-p2" />
          <span className="orb orb-o2" />
        </div>
        {children}
      </body>
    </html>
  );
}
