import { BlackbookPage } from "@/components/blackbook/page-shell";
import { ProfileForm } from "@/components/blackbook/profile-form";

export default function Page() {
  return (
    <BlackbookPage title="Profile" subtitle="Who you are and what you like">
      <ProfileForm />
    </BlackbookPage>
  );
}
