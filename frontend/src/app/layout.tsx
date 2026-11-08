import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Outfit } from "next/font/google";
import ToastProvider from "@/components/Toast";
import "./globals.css";

// Brand display face. Note: this file is the "Personal Use Only" release.
const fogie = localFont({
  src: "../fonts/Fogie.ttf",
  variable: "--font-fogie",
  display: "swap",
});

// Small body text, where a display serif would be hard to read.
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Eagle - Farm supplies, sourced simply", template: "%s · Eagle" },
  description:
    "Eagle matches your farm with trusted suppliers in your state, drafts the outreach emails, and helps you compare every reply.",
};

export const viewport: Viewport = {
  themeColor: "#f6f4ec",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fogie.variable} ${outfit.variable}`}>
      <body className="bg-surface font-sans text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
