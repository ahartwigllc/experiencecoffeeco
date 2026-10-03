import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = process.env.SITE_URL || "https://experiencecoffee.co";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Experience Coffee", template: "%s | Experience Coffee" },
  description:
    "Small-batch specialty coffee and cold brew, roasted in Lyndhurst, NJ. Single-origin lots, local delivery and pickup, and subscriptions that save 20%.",
  openGraph: {
    type: "website",
    siteName: "Experience Coffee",
    url: SITE,
    images: ["/images/og.png"],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#8e1c2e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
