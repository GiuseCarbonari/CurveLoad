import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Carattere unico del design system (command center, Passo 7).
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CurveLoad",
  description:
    "Coach AI endurance connesso a Intervals.icu: pianifica, adatta e spiega l'allenamento usando dati reali e il protocollo Section 11.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0f0a" },
    { media: "(prefers-color-scheme: light)", color: "#c3c8bc" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={manrope.variable}
    >
      <head>
        {/*
          Applica il tema salvato prima del primo paint per evitare il flash.
          Default: CHIARO (il command center è un tema chiaro — Passo 7); si
          passa allo scuro solo se l'utente l'ha scelto con l'interruttore.
          La chiave deve restare allineata con components/layout/theme-toggle.tsx.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('curveload-theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
