import { BlackbookPage } from "@/components/blackbook/page-shell";
import { ContentList } from "@/components/blackbook/content-list";
import { getCurrentUser } from "@/lib/auth";
import { userPrefs } from "@/lib/blackbook";

export default async function Page() {
  const user = (await getCurrentUser())!;
  return (
    <BlackbookPage title="Comics" subtitle="Yours and your favorites">
      <ContentList kind="comics" blur={userPrefs(user).blurNsfw} />
    </BlackbookPage>
  );
}
