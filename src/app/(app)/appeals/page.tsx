import { AppealsCenter } from "@/components/moderation/appeals-center";
export const metadata = { title: "Appeals" };
export default function AppealsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl">Moderation & appeals</h1>
        <p className="text-sm text-muted">If something of yours was hidden or removed, you can appeal here. A human reviews every appeal.</p>
      </div>
      <AppealsCenter />
    </div>
  );
}
