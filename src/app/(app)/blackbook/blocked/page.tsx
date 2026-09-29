import { BlackbookPage } from "@/components/blackbook/page-shell";
import { BlockedList } from "@/components/blackbook/blocked-list";

export default function Page() {
  return (
    <BlackbookPage title="Blocked" subtitle="Creators you never want to see">
      <BlockedList />
    </BlackbookPage>
  );
}
