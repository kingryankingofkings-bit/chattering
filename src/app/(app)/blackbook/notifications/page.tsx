import { BlackbookPage } from "@/components/blackbook/page-shell";
import { NotificationsForm } from "@/components/blackbook/notifications-form";

export default function Page() {
  return (
    <BlackbookPage title="Notifications" subtitle="What we tell you about">
      <NotificationsForm />
    </BlackbookPage>
  );
}
