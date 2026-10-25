import { auth } from "@clerk/nextjs/server";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session.isAuthenticated) {
    return session.redirectToSignIn();
  }

  void createSupabaseServerClient(session.getToken);

  return (
    <AppShell organizationId={session.orgId ?? null}>{children}</AppShell>
  );
}
