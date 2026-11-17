import Link from "next/link";
import { CandlestickChart, Shield, UserRound } from "lucide-react";

type Workspace = "trade" | "account" | "admin";

const WORKSPACES = [
  { key: "trade", href: "/trade/AUDCAD", label: "Trade Terminal", compactLabel: "Trade", Icon: CandlestickChart },
  { key: "account", href: "/account", label: "Account", compactLabel: "Account", Icon: UserRound },
  { key: "admin", href: "/admin", label: "Admin", compactLabel: "Admin", Icon: Shield },
] as const;

export function WorkspaceNavigation({
  current,
  showAdmin = false,
  className = "",
}: {
  current: Workspace;
  showAdmin?: boolean;
  className?: string;
}) {
  const workspaces = showAdmin ? WORKSPACES : WORKSPACES.filter((workspace) => workspace.key !== "admin");

  return (
    <nav aria-label="Workspace navigation" className={`flex min-w-0 items-center gap-1 overflow-x-auto text-xs ${className}`}>
      {workspaces.map(({ key, href, label, compactLabel, Icon }) => {
        const content = (
          <>
            <Icon size={14} strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{compactLabel}</span>
          </>
        );
        const itemClassName = `flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors duration-150 ${
          current === key
            ? "bg-accent font-semibold text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`;

        return current === key ? (
          <span key={key} aria-current="page" className={itemClassName}>{content}</span>
        ) : (
          <Link key={key} href={href} className={itemClassName}>{content}</Link>
        );
      })}
    </nav>
  );
}
