import { Button } from "@/components/ui";
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl">Nothing here but shadows.</h1>
      <p className="text-sm text-muted">That page doesn&apos;t exist, or it was kept private.</p>
      <Button href="/explore">Back to Explore</Button>
    </div>
  );
}
