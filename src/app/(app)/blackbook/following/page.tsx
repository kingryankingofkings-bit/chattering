import { BlackbookPage } from "@/components/blackbook/page-shell";
import { FollowingList } from "@/components/blackbook/following-list";

export default function Page() {
  return (
    <BlackbookPage title="Following" subtitle="Creators you keep up with">
      <FollowingList />
    </BlackbookPage>
  );
}
