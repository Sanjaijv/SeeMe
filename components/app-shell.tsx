import type { ReactNode } from "react";
import Link from "next/link";

import { OrganizationControls } from "@/components/organization-controls";
import { ThemeControl } from "@/components/theme-control";

export function AppShell({
  children,
  organizationId,
}: {
  children: ReactNode;
  organizationId: string | null;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-panel p-4 md:flex md:flex-col">
        <div className="mb-8">
          <p className="font-mono text-sm font-semibold tracking-tight">
            seeme
          </p>
          <p className="mt-1 text-xs text-muted">Dependency maps for teams</p>
        </div>
        <nav aria-label="Primary navigation" className="space-y-1 text-sm">
          <Link
            className="block rounded bg-panel-strong px-3 py-2 font-medium"
            href="/"
          >
            Workspace
          </Link>
        </nav>
        <p className="mt-auto font-mono text-[11px] text-muted">
          {organizationId ?? "No organization selected"}
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-panel px-4 md:px-6">
          <OrganizationControls />
          <ThemeControl />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
