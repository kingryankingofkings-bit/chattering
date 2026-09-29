import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AgeGateForm } from "@/components/shell/age-gate-form";
export const metadata = { title: "Age verification" };
export default async function AgeGatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AgeGateForm alreadyVerified={!!user.ageVerifiedAt} />;
}
