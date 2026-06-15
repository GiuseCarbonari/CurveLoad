import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coach IA",
  description:
    "Coach AI endurance connesso a Intervals.icu: pianifica, adatta e spiega l'allenamento usando dati reali e il protocollo Section 11.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
