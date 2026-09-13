import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { AuthProvider } from "@/components/Auth/AuthContext";
import { GuideProvider } from "@/components/Guide/GuideContext";
import { GuideChat } from "@/components/Guide/GuideChat";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ViewportHeightSync } from "@/components/ViewportHeightSync";
import { cookies, headers } from "next/headers";
import { LanguageProvider, type AppLanguage } from "@/components/I18n/LanguageProvider";

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
    icon: [{ url: "/splash-logo-02-wordmark-192.png", type: "image/png", sizes: "192x192" }],
    shortcut: "/splash-logo-02-wordmark-192.png",
    apple: [{ url: "/splash-logo-02-wordmark-180.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7c6ae6",
};

/**
 * Signature: `async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element>`
 * Purpose: Provide the CloudFootprints Tokyo document shell, product metadata, shared providers, and primary navigation.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const savedLanguage = cookieStore.get("tem_language")?.value;
  const preferredLanguage = requestHeaders.get("accept-language")?.toLowerCase() ?? "";
  const initialLanguage: AppLanguage = savedLanguage === "ja" || savedLanguage === "en" || savedLanguage === "zh"
    ? savedLanguage
    : preferredLanguage.startsWith("ja")
      ? "ja"
      : preferredLanguage.startsWith("en")
        ? "en"
        : preferredLanguage.startsWith("zh")
          ? "zh"
          : "en";

  return (
    <html
      lang={initialLanguage === "zh" ? "zh-CN" : initialLanguage}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="app-viewport flex flex-col overflow-hidden">
        <ViewportHeightSync />
        <LanguageProvider initialLanguage={initialLanguage}>
        <AuthProvider>
          <GuideProvider>
            <main className="flex-1 min-h-0 relative">{children}</main>
            <BottomNav />
            <GuideChat />
            <InstallPrompt />
          </GuideProvider>
        </AuthProvider>
        </LanguageProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
