import { BlackbookPage } from "@/components/blackbook/page-shell";
import { AccountPanel } from "@/components/blackbook/account-panel";
import { getCurrentUser } from "@/lib/auth";

export default async function Page() {
  const user = (await getCurrentUser())!;
  return (
    <BlackbookPage title="Account" subtitle="Data, password, deletion">
      <AccountPanel email={user.email} />
    </BlackbookPage>
  );
}
