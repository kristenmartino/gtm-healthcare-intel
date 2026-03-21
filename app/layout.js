import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://gtm.kristenmartino.ai"),
  title: "GTM Healthcare Intelligence — Kristen Martino",
  description:
    "Interactive analytics portfolio demonstrating go-to-market business intelligence for the specialty healthcare EHR space.",
  openGraph: {
    title: "GTM Healthcare Intelligence — Kristen Martino",
    description:
      "Interactive analytics portfolio demonstrating go-to-market business intelligence for the specialty healthcare EHR space.",
    url: "https://gtm.kristenmartino.ai",
    siteName: "GTM Healthcare Intelligence",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "GTM Healthcare Intelligence — Kristen Martino",
    description:
      "Interactive analytics portfolio demonstrating go-to-market BI for specialty healthcare.",
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
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
