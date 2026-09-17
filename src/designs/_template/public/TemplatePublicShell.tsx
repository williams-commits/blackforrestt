import type { PublicDesignProps } from "@/designs/contracts";

/** Starter public shell. */
export async function TemplatePublicShell({ children }: PublicDesignProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
    </div>
  );
}
