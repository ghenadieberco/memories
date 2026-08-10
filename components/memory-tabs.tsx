import Link from "next/link";

/*
 * Tabs — style guide §6.
 * Glass pill row; inactive is muted on faint white, active is solid white with
 * purple text and a soft purple shadow.
 */
export function MemoryTabs({ active }: { active: "mine" | "shared" }) {
  const tabs = [
    { key: "mine" as const, label: "My memories", href: "/memories" },
    { key: "shared" as const, label: "Shared with me", href: "/shared" },
  ];

  return (
    <nav
      className="glass inline-flex gap-1 rounded-xl p-1"
      aria-label="Memory sections"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className="rounded-[13px] px-3.5 py-2 text-[13px] font-bold transition-colors"
            style={
              isActive
                ? {
                    background: "#fff",
                    color: "var(--purple)",
                    boxShadow: "0 6px 16px rgba(122,47,242,.16)",
                  }
                : { color: "var(--muted-ink)" }
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
