import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/server/db";
import { Sidebar } from "@/components/Sidebar";
import { SidebarCollapseProvider, SidebarToggle } from "@/components/SidebarCollapse";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickActions } from "@/components/QuickActions";
import { Button } from "@/components/ui";
import { Initials } from "@/components/Initials";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { PageLoadingNotice } from "@/components/PageLoadingNotice";
import { RealtimeBridge } from "@/components/RealtimeBridge";

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

  return (
    <>
      <RealtimeBridge />
      <SidebarCollapseProvider>
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
            <SidebarToggle />
            <GlobalSearch />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <QuickActions />

            <NotificationBell />

            {/* Theme toggle */}
            <ThemeToggle />

            {/* User chip */}
            <div className="hidden items-center gap-2 md:flex">
              <span title={user.email ?? user.name}>
                <Initials name={user.name} size="md" />
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
              <Button
                type="submit"
                variant="tertiary"
                size="sm"
                title="Sign out"
              >
                Sign out
              </Button>
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
        <PageLoadingNotice />
      </div>
      </div>
      </SidebarCollapseProvider>
    </>
  );
}
