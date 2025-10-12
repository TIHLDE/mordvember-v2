import type { Metadata, Viewport } from "next";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Mordvember deltakere 2025",
  description: "Mordvember participant tracking",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
