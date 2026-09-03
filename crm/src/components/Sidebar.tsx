import Link from "next/link";

// Primary navigation. Items marked `phase` are scaffolded by later phases —
// they render disabled so the roadmap is visible inside the product itself.
const NAV_ITEMS: Array<{ href: string; label: string; phase?: number }> = [
  { href: "/", label: "Home" },
  { href: "/leads", label: "Leads" },
  { href: "/contacts", label: "Contacts" },
  { href: "/customers", label: "Customers" },
  { href: "/accounts", label: "Accounts" },
  { href: "/opportunities", label: "Opportunities", phase: 5 },
  { href: "/tasks", label: "Tasks" },
  { href: "/campaigns", label: "Campaigns", phase: 7 },
  { href: "/reports", label: "Reports", phase: 9 },
  { href: "/admin", label: "Administration", phase: 7 },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-4">
        <span
          aria-hidden
          className="inline-block h-7 w-7 rounded-md"
          style={{ background: "var(--brand)" }}
        />
        <div>
          <p className="text-sm font-semibold">Black Forest CRM</p>
          <p className="text-xs text-stone-500">Sales workspace</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) =>
          item.phase ? (
            <span
              key={item.href}
              aria-disabled
              className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-stone-400"
              title={`Arrives in Phase ${item.phase}`}
            >
              {item.label}
              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-400">
                P{item.phase}
              </span>
            </span>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              {item.label}
            </Link>
          ),
        )}
      </nav>
    </aside>
  );
}
