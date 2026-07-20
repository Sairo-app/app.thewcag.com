import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-face",
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";
const DESCRIPTION =
  "TheWCAG is a desktop app for macOS and Windows that checks WCAG color contrast anywhere on screen, simulates color blindness, and turns annotated screenshots into shareable accessibility reports.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "TheWCAG - Color contrast checker & accessibility screenshot tool",
    template: "%s - TheWCAG",
  },
  description: DESCRIPTION,
  applicationName: "TheWCAG",
  keywords: [
    "color contrast checker",
    "WCAG contrast checker",
    "accessibility checker",
    "color blindness simulator",
    "WCAG 2.2",
    "contrast ratio checker",
    "APCA contrast",
    "accessibility audit tool",
    "screen color picker",
  ],
  authors: [{ name: "TheWCAG" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "TheWCAG",
    url: SITE,
    title: "TheWCAG - Color contrast checker & accessibility screenshot tool",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "TheWCAG - Color contrast checker for macOS & Windows",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
        <a
          href="#main"
          className="sr-only rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
