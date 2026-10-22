import type { Metadata, Viewport } from "next";
import { App } from "@/components/App";
import { THEMA_SKRIPT } from "@/components/Thema";
import "./globals.css";

export const metadata: Metadata = { title: "highstack", description: "Ihr privates Family Office für Immobilien" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <meta name="theme-color" content="#f6f7fa" />
        <script dangerouslySetInnerHTML={{ __html: THEMA_SKRIPT }} />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,600&display=swap" />
      </head>
      <body><App>{children}</App></body>
    </html>
  );
}
