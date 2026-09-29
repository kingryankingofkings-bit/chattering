import { WifiOff } from "lucide-react";
export const dynamic = "force-static";
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="h-10 w-10 text-warning" />
      <h1 className="text-2xl">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted">Pages you already opened and recent chats are available from your device. Reconnect to load anything new.</p>
      <a href="/explore" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">Retry</a>
    </div>
  );
}
