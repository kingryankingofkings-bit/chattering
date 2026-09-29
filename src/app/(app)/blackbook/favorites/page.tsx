import { BlackbookPage } from "@/components/blackbook/page-shell";
import { FavoritesList } from "@/components/blackbook/favorites-list";
import { getCurrentUser } from "@/lib/auth";
import { userPrefs } from "@/lib/blackbook";

export default async function Page() {
  const user = (await getCurrentUser())!;
  return (
    <BlackbookPage title="Favorites" subtitle="Characters you hearted">
      <FavoritesList blur={userPrefs(user).blurNsfw} />
    </BlackbookPage>
  );
}
