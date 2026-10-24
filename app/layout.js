import "./globals.css";
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  metadataBase: new URL("https://gtm.kristenmartino.ai"),
  title: "GTM Healthcare Intelligence — Kristen Martino",
  description:
    "Interactive demos exploring pipeline conversion, market prioritization, and metric governance for specialty healthcare software.",
  openGraph: {
    title: "GTM Healthcare Intelligence — Kristen Martino",
    description:
      "Interactive demos exploring pipeline conversion, market prioritization, and metric governance for specialty healthcare software.",
    url: "https://gtm.kristenmartino.ai",
    siteName: "GTM Healthcare Intelligence",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "GTM Healthcare Intelligence — Kristen Martino",
    description:
      "GTM analytics for specialty healthcare software. Synthetic demos, calculation methods, and documented limitations.",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport = {
  themeColor: "#0b1120",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap" rel="stylesheet" />
      </head>
      <body className="gtm-app">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
