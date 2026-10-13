import { Logo } from "@/components/trade/Logo";

/**
 * Shared presentation-only shell for the authentication surfaces — login,
 * register, forgot/reset password, verify email. One layout language: panel
 * canvas, centered max-w-sm column, logo, optional foot-note. Purely
 * presentational; each page keeps its own form, submission logic, and
 * messages.
 */
export function AuthShell({
  children,
  footerNote,
}: {
  children: React.ReactNode;
  footerNote?: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-dvh items-center justify-center bg-panel px-4 py-8 sm:py-10"
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="mb-6">
          <Logo className="text-lg" />
        </div>
        {children}
        {footerNote ? (
          <p className="mt-6 max-w-xs text-center text-[11px] text-text-faint">{footerNote}</p>
        ) : null}
      </div>
    </main>
  );
}

/**
 * The auth card — canvas surface, hairline border, panel shadow, centered
 * heading with short supporting copy above the page-specific form.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full rounded-md border border-border bg-canvas p-5 shadow-panel sm:p-8">
      <h1 className="mb-1 text-center text-lg font-semibold">{title}</h1>
      {subtitle ? <p className="mb-6 text-center text-xs text-text-muted">{subtitle}</p> : null}
      {children}
    </div>
  );
}
