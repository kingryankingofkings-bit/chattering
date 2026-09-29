import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { OfflineProvider } from "@/components/shell/offline-provider";

export const metadata: Metadata = {
  title: { default: "Chattering", template: "%s · Chattering" },
  description: "Private, adults-only AI companions, roleplay, stories, comics and art. 18+ only.",
  applicationName: "Chattering",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Chattering" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0710",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <OfflineProvider>{children}</OfflineProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
