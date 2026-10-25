"use client";

import {
  InviteMembersButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";

export function OrganizationControls() {
  return (
    <div className="flex items-center gap-2">
      <OrganizationSwitcher
        afterCreateOrganizationUrl="/"
        afterSelectOrganizationUrl="/"
        hidePersonal
      />
      <InviteMembersButton />
    </div>
  );
}
