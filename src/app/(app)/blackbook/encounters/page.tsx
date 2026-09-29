import { BlackbookPage } from "@/components/blackbook/page-shell";
import { EncountersList } from "@/components/blackbook/encounters-list";

export default function Page() {
  return (
    <BlackbookPage title="Saved encounters" subtitle="Scenarios you kept">
      <EncountersList />
    </BlackbookPage>
  );
}
