import { CredentialsPanel } from "@/components/credentials-panel";
import { PageHeader } from "@/components/ui";
import { scanCredentials } from "@/lib/credentials";

export default async function CredentialsPage() {
  const { plaintext, secured } = await scanCredentials();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Secrets"
        title="Credentials hygiene"
        description="Detect inline secrets, recommend SecretRef migrations, and keep model and channel credentials out of the browser."
      />
      <CredentialsPanel plaintext={plaintext} secured={secured} />
    </div>
  );
}
