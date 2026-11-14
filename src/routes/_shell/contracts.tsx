import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/page-header";
import { NoImportedData } from "@/components/common/no-data";

export const Route = createFileRoute("/_shell/contracts")({
  head: () => ({
    meta: [
      { title: "Contracts — AutoAudit" },
      {
        name: "description",
        content:
          "Contract terms and rate cards compared against what vendors actually bill, once a contract source is connected.",
      },
      { property: "og:title", content: "Contracts — AutoAudit" },
      {
        property: "og:description",
        content: "Contract terms compared against what vendors actually bill.",
      },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  return (
    <>
      <PageHeader
        title="Contracts"
        description="Contract terms and rate cards compared against what vendors actually bill."
        crumbs={[{ label: "Contracts" }]}
      />
      <NoImportedData
        title="No contracts imported yet"
        description="Your connected accounting account doesn't send contract records. Connect a system that holds contracts, and they will be compared against your imported invoices here."
      />
    </>
  );
}
