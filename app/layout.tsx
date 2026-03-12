import type { Metadata, Viewport } from "next";
import { Kanit, Prompt } from "next/font/google";
import "./globals.css";
import { CartSlideOutWrapper } from "@/components/CartSlideOutWrapper";
import { GlobalSlideOuts } from "@/components/GlobalSlideOuts";
import { NavigationLoadingOverlay } from "@/components/NavigationLoadingOverlay";
import { ToastBar } from "@/components/ToastBar";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { BoardAnnouncementPoller } from "@/components/BoardAnnouncementPoller";
import { ErudaDev } from "@/components/ErudaDev";

const kanit = Kanit({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-kanit",
});

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "Sakura Market | Spatial Marketplace",
  description: "Infinite 2D marketplace",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${kanit.variable} ${prompt.variable} font-sans antialiased overflow-x-hidden`} suppressHydrationWarning>
        <ErudaDev />
        <NavigationLoadingOverlay>
          <PresenceHeartbeat />
          <BoardAnnouncementPoller />
          {children}
          <CartSlideOutWrapper />
          <GlobalSlideOuts />
        </NavigationLoadingOverlay>
        <ToastBar />
      </body>
    </html>
  );
}
