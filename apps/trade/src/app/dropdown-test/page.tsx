"use client";

import { VerificationTab } from "@/components/account/VerificationTab";

export default function DropdownTestPage() {
  return (
    <main className="account-flat terminal-ui mx-auto min-h-screen w-full max-w-5xl p-4 sm:p-8">
      <VerificationTab
        kyc={null}
        checklist={{
          cleanDocuments: 0,
          cleanIdentityDocuments: 0,
          cleanAddressDocuments: 0,
          pendingDocuments: 0,
          blockedDocuments: 0,
        }}
        onSubmitted={() => {}}
      />
    </main>
  );
}
