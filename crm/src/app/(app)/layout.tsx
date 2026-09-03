import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/server/db";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";

export const dynamic = "force-dynamic";

/** Authenticated app shell: sidebar + user bar. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, role: { select: { name: true, scope: true } } },
  });
  if (!user) redirect("/login");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-8 py-4">
          <GlobalSearch />
          <div className="flex items-center gap-4">
            <p className="text-sm text-stone-500">
              {user.name} · {user.role.name} (scope: {user.role.scope.toLowerCase()})
            </p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
