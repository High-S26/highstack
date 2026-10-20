import type { Metadata, Viewport } from "next";
import { App } from "@/components/App";
import "./globals.css";

export const metadata: Metadata = { title: "highstack", description: "Ihr privates Family Office für Immobilien" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" />
      </head>
      <body><App>{children}</App></body>
    </html>
  );
}
