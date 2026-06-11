import type { Metadata } from "next";
import "./globals.css";
import { getSiteUrl } from "./site-url";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Legajo Digital",
    template: "%s | Legajo Digital",
  },
  description:
    "Sistema institucional para administrar legajos, asistencia e historial del personal.",
  applicationName: "Legajo Digital",
  authors: [{ name: "Legajo Digital" }],
  creator: "Legajo Digital",
  publisher: "Legajo Digital",
  keywords: [
    "Legajo Digital",
    "gestion de legajos",
    "software institucional",
    "recursos humanos",
    "asistencia",
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
