import type { Metadata } from "next";
import { Sora, Manrope } from "next/font/google";
import "./globals.css";
import MainLayout from "@/components/MainLayout";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

import { TenantProvider } from "@/lib/TenantProvider";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "AtelIA",
  description: "A primeira plataforma feita exclusivamente para artesãos e artesãs gerenciarem seus negócios.",
  manifest: "/manifest.json",
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    images: [{
      url: '/opengraph-image.png',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image.png'],
  },
  appleWebApp: {
    capable: true,
    title: 'AtelIA',
    statusBarStyle: 'default'
  }
};

export const viewport = {
  themeColor: '#F39C12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${sora.variable} ${manrope.variable} font-sans bg-background text-foreground antialiased`}>
        <TenantProvider>
          <MainLayout>
            {children}
          </MainLayout>
          <Toaster position="bottom-right" />
        </TenantProvider>
      </body>
    </html>
  );
}
