import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
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
  title: "东京活动地图",
  description: "在地图上一眼看全附近正在举行的活动",
};

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
      <body className="h-screen flex flex-col overflow-hidden">
        <GuideProvider>
          <main className="flex-1 min-h-0 relative">{children}</main>
          <BottomNav />
          <GuideChat />
        </GuideProvider>
      </body>
    </html>
  );
}
