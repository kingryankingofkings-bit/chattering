import { BlackbookPage } from "@/components/blackbook/page-shell";
import { PersonasManager } from "@/components/blackbook/personas-manager";

export default function Page() {
  return (
    <BlackbookPage title="Personas" subtitle="Who you are in a scene">
      <PersonasManager />
    </BlackbookPage>
  );
}
