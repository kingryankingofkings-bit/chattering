import { BlackbookPage } from "@/components/blackbook/page-shell";
import { SubscriptionPanel } from "@/components/blackbook/subscription-panel";

export default function Page() {
  return (
    <BlackbookPage title="Subscription" subtitle="Your plan">
      <SubscriptionPanel />
    </BlackbookPage>
  );
}
