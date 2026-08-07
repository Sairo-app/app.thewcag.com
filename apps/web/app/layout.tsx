import type { Metadata } from "next";
import { headers } from "next/headers";
import { JetBrains_Mono, Manrope, Source_Sans_3 } from "next/font/google";
import { PRODUCT_DESCRIPTION, SITE_URL, SOCIAL_IMAGE } from "@/lib/seo";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display-loaded",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TheWCAG | Accessibility audit software and evidence capture",
    template: "%s | TheWCAG",
  },
  description: PRODUCT_DESCRIPTION,
  applicationName: "TheWCAG",
  keywords: [
    "accessibility audit software",
    "WCAG audit tool",
    "Chrome accessibility extension",
    "accessibility evidence capture",
    "WCAG contrast checker",
    "color blindness simulator",
    "WCAG 2.2",
    "accessibility findings management",
    "accessibility reporting software",
    "VPAT authoring software",
    "accessibility issue tracker integrations",
    "accessibility program management",
  ],
  authors: [{ name: "TheWCAG" }],
  creator: "TheWCAG",
  publisher: "TheWCAG",
  category: "Accessibility software",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  openGraph: {
    type: "website",
    siteName: "TheWCAG",
    locale: "en_US",
    url: SITE_URL,
    title: "TheWCAG | Accessibility audit software and evidence capture",
    description: PRODUCT_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "TheWCAG | Accessibility audit software",
    description: PRODUCT_DESCRIPTION,
    images: [SOCIAL_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce-based CSP requires request-time rendering so Next can apply the
  // middleware nonce to its framework scripts.
  await headers();
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
