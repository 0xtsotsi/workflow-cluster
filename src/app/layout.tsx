import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { Toaster } from "@/components/ui/sonner";
import { AppLoader } from "@/components/ui/app-loader";
import { ChatbotWidget } from "@/components/ui/chatbot-widget";

const interHeading = Inter({
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  subsets: ["latin"],
});

const interBody = Inter({
  weight: ["400", "500"],
  variable: "--font-body",
  subsets: ["latin"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Social Cat",
  description: "AI-powered social media automation platform",
  icons: {
    icon: '/cat-icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${interHeading.variable} ${interBody.variable} ${inter.variable} antialiased`}
      >
        <AppLoader />
        <SessionProvider>
          {children}
          <ChatbotWidget />
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
