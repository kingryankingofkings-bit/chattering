import { redirect } from "next/navigation";
import { getCurrentUser, isModerator } from "@/lib/auth";
import { ModerationQueue } from "@/components/moderation/moderation-queue";
export const metadata = { title: "Moderation" };
export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!isModerator(user)) redirect("/blackbook");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl">Moderation</h1>
        <p className="text-sm text-muted">Reports and appeals. Hide keeps content recoverable; Remove is for policy violations. Every action is logged.</p>
      </div>
      <ModerationQueue />
    </div>
  );
}
