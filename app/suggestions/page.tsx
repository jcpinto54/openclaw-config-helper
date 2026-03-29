import { SetupWizard } from "@/components/setup-wizard";
import { SuggestionsPanel } from "@/components/suggestions-panel";
import { PageHeader } from "@/components/ui";
import { getAppSettings } from "@/lib/settings";
import { getSuggestionHistory, listSuggestions } from "@/lib/suggestions";

export default async function SuggestionsPage() {
  const [list, history] = await Promise.all([listSuggestions(), getSuggestionHistory()]);
  const settings = getAppSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Discovery"
        title="Suggestions feed"
        description="A ranked stream of use-case ideas and automation cards, with save, dismiss, and apply workflows."
      />
      {!settings.onboardingCompleted ? <SetupWizard /> : null}
      <SuggestionsPanel
        suggestions={list.suggestions}
        history={history.history}
        timestamp={list.timestamp}
      />
    </div>
  );
}
