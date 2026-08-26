import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Providers } from "./providers";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export const metadata: Metadata = {
  title: {
    default: "NexusWMS - AI Warehouse Management",
    template: "%s | NexusWMS",
  },
  description:
    "Enterprise warehouse management with AI demand forecasting, inventory control and dispatch orchestration.",
  metadataBase: APP_URL ? new URL(APP_URL) : undefined,
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
