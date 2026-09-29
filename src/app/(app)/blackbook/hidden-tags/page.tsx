import { BlackbookPage } from "@/components/blackbook/page-shell";
import { HiddenTagsEditor } from "@/components/blackbook/hidden-tags-editor";

export default function Page() {
  return (
    <BlackbookPage title="Hidden tags" subtitle="Filter out what you are not into">
      <HiddenTagsEditor />
    </BlackbookPage>
  );
}
