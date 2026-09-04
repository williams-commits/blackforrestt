import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/server/db";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickActions } from "@/components/QuickActions";
import { ToastProvider } from "@/components/Toast";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

/** Authenticated app shell: sidebar + enterprise top bar + content area. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: { select: { name: true, scope: true } } },
  });
  if (!user) redirect("/login");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarColors = ["#15803d", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
  const avatarColor = avatarColors[user.name.length % avatarColors.length];

  return (
    <ToastProvider>
      <div className="flex min-h-screen" style={{ background: "var(--bg-app)" }}>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Top bar ── */}
        <header
          className="sticky top-0 z-30 flex h-13 shrink-0 items-center justify-between gap-4 border-b px-4 lg:px-6"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-surface)",
            boxShadow: "var(--shadow-subtle)",
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3 pl-10 lg:pl-0">
            <GlobalSearch />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <QuickActions />

            {/* Notification bell placeholder — wired via HomeWidgets */}
            <div
              className="hidden h-8 w-8 items-center justify-center rounded-full border sm:flex"
              style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
              title="Notifications"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </div>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* User chip */}
            <div className="hidden items-center gap-2 md:flex">
              <span
                className="avatar"
                style={{ background: avatarColor, color: "var(--text-inverse)" }}
                title={user.email ?? user.name}
              >
                {initials}
              </span>
              <div className="leading-tight">
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {user.name}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {user.role.name}
                </p>
              </div>
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="btn btn-ghost text-[12px]"
                title="Sign out"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* ── Content area ── */}
        <main
          className="min-w-0 flex-1 animate-fade"
          style={{ maxWidth: "var(--content-max)", width: "100%", margin: "0 auto", padding: "var(--space-6)" }}
        >
          {children}
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
