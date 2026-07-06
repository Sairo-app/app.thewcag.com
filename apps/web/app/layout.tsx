import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheWCAG",
  description: "Sign in and share accessibility reports from the TheWCAG desktop app.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
