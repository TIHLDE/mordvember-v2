import "@fontsource/creepster/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mordvember",
  description: "Mordvember i TIHLDE",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body className="font-sans text-zinc-200 antialiased">{children}</body>
    </html>
  );
}

