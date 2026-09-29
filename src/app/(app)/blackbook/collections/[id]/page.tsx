import { BlackbookPage } from "@/components/blackbook/page-shell";
import { CollectionDetail } from "@/components/blackbook/collection-detail";
import { getCurrentUser } from "@/lib/auth";
import { userPrefs } from "@/lib/blackbook";

export default async function Page({ params }: PageProps<"/blackbook/collections/[id]">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  return (
    <BlackbookPage title="" back="/blackbook/collections" backLabel="Collections">
      <CollectionDetail id={id} blur={userPrefs(user).blurNsfw} />
    </BlackbookPage>
  );
}
