import { BlackbookPage } from "@/components/blackbook/page-shell";
import { RecentChats } from "@/components/blackbook/recent-chats";

export default function Page() {
  return (
    <BlackbookPage title="Recent chats" subtitle="Pick up where you left off">
      <RecentChats />
    </BlackbookPage>
  );
}
