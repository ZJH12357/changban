import type { Metadata } from "next";
import "./globals.css";
import "./pet.css";
import "./history.css";
import "./experience.css";

export const metadata: Metadata = {
  title: "常伴 V2 · 家庭关怀与桌宠陪伴",
  description: "把每一天的小事记好，让团团陪您一起，把家人的关心留在身边。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
