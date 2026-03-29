import { AuditPanel } from "@/components/audit-panel";
import { PageHeader } from "@/components/ui";
import { getLatestFindings } from "@/lib/audit";

export default async function AuditPage() {
  const { findings, timestamp } = await getLatestFindings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Security audit dashboard"
        description="Review audit findings, apply safe remediations, and track which issues still need manual review."
      />
      <AuditPanel findings={findings} timestamp={timestamp} />
    </div>
  );
}
