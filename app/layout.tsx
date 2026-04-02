import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppNav, { NavSpacer } from "@/components/AppNav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GAA Exchange",
  description: "Buy and sell GAA jerseys",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white">
        <main className="flex-1">{children}<NavSpacer /></main>
        <AppNav />
      </body>
    </html>
  );
}
