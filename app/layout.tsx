import type { Metadata } from "next";
import "./globals.css";
import { getSiteUrl } from "./site-url";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "B Software | Productos web y software de gestion",
    template: "%s | B Software",
  },
  description:
    "B Software desarrolla sistemas de gestion, portales de consulta, aplicaciones internas y sitios optimizados para SEO.",
  applicationName: "B Software",
  authors: [{ name: "B Software" }],
  creator: "B Software",
  publisher: "B Software",
  keywords: [
    "B Software",
    "productos web",
    "software de gestion",
    "desarrollo de aplicaciones",
    "portales de consulta",
    "SEO",
    "gestion de legajos",
    "software institucional",
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
