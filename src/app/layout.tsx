import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { AuthProvider } from "@/components/Auth/AuthContext";
import { GuideProvider } from "@/components/Guide/GuideContext";
import { GuideChat } from "@/components/Guide/GuideChat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "云迹东京",
  title: {
    default: "云迹东京｜发现活动，记录足迹",
    template: "%s｜云迹东京",
  },
  description: "发现东京附近的活动与生活动态，规划路线、记录到访，并留下属于你的城市足迹。",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "48x48" }],
    shortcut: "/icon.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

/**
 * Signature: `function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element`
 * Purpose: Provide the CloudFootprints Tokyo document shell, product metadata, shared providers, and primary navigation.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-[100dvh] flex flex-col overflow-hidden">
        <AuthProvider>
          <GuideProvider>
            <main className="flex-1 min-h-0 relative">{children}</main>
            <BottomNav />
            <GuideChat />
          </GuideProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
