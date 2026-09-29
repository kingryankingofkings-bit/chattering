import { BlackbookPage } from "@/components/blackbook/page-shell";
import { CollectionsList } from "@/components/blackbook/collections-list";

export default function Page() {
  return (
    <BlackbookPage title="Collections" subtitle="Your curated sets">
      <CollectionsList />
    </BlackbookPage>
  );
}
