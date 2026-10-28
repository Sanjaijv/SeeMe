"use client";

import {
  InviteMembersButton,
  OrganizationSwitcher,
  useOrganization,
} from "@clerk/nextjs";

export function OrganizationControls() {
  const { isLoaded, organization } = useOrganization();

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs font-medium text-foreground">
        Workspace
      </span>
      <OrganizationSwitcher
        afterCreateOrganizationUrl="/"
        afterSelectOrganizationUrl="/"
        hidePersonal
      />
      {isLoaded && organization ? (
        <InviteMembersButton />
      ) : (
        <span className="font-mono text-xs text-muted">
          Select an organization to invite members
        </span>
      )}
    </div>
  );
}
