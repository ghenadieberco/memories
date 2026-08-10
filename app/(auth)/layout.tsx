import Link from "next/link";

import { Wordmark } from "@/components/wordmark";

/*
 * Shell for every unauthenticated screen. One bold element — the wordmark —
 * with a quiet glass panel beneath it (style guide §11).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-[22px] py-[26px]">
      <div className="w-full max-w-[420px] flex flex-col items-center gap-7">
        <Link href="/" aria-label="Memories home">
          <Wordmark size="hero" />
        </Link>
        <div className="glass w-full rounded-[26px] p-[22px]">{children}</div>
      </div>
    </main>
  );
}
