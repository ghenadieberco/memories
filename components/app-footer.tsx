/*
 * The version footer (FR-VER-2, D28).
 *
 * Sits on every page — landing, auth, app shell and the public guest link
 * alike — so any screenshot in a bug report carries the build it came from.
 *
 * Deliberately the quietest thing on the page: muted caption weight, no glass,
 * no border. Style guide §11 allows exactly one bold element per screen, and
 * this is never it.
 *
 * `NEXT_PUBLIC_APP_VERSION` is inlined at build time (see next.config.ts), so
 * this stays a server component and costs no client JavaScript.
 */
export function AppFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  if (!version) return null;

  return (
    <footer className="px-[22px] pt-2 pb-[18px] text-center">
      <p className="text-[12.5px] font-semibold text-muted-ink">
        Memories <span className="tabular-nums">v{version}</span>
      </p>
    </footer>
  );
}
