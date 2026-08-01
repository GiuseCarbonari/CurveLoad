import type { Config } from "tailwindcss";

// Configurazione Tailwind con il tema a CSS variables di shadcn/ui.
// I token (--background, --primary, ecc.) sono definiti in app/globals.css.

/**
 * Colore preso da una CSS variable, con supporto ai modificatori di opacità.
 *
 * Serve perché una variabile scritta come stringa (`"var(--brand)"`) fa
 * saltare a Tailwind TUTTE le classi con opacità: `bg-brand/40`,
 * `border-ready-go/45`, `bg-ready-skip/[0.16]` non generavano nessuna regola
 * e gli elementi restavano senza sfondo né bordo. Con la forma a funzione
 * Tailwind ci passa l'opacità e possiamo comporla con `color-mix`.
 *
 * Senza modificatore l'output resta identico a prima: `var(--nome)`.
 *
 * Il cast finale c'è perché i tipi TS di Tailwind dichiarano i colori come
 * sole stringhe, mentre a runtime la forma a funzione è supportata
 * (https://tailwindcss.com/docs/customizing-colors#using-css-variables).
 */
function token(name: string): string {
  const fn = ({ opacityValue }: { opacityValue?: string } = {}) =>
    !opacityValue || opacityValue.startsWith("var(")
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;
  return fn as unknown as string;
}

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Token semantici shadcn/ui, mappati sulla palette del design system
        // (variabili definite in app/globals.css, valori raw hex/rgba).
        border: token("--border"),
        input: token("--input"),
        ring: token("--ring"),
        background: token("--background"),
        foreground: token("--foreground"),
        primary: {
          DEFAULT: token("--primary"),
          foreground: token("--primary-foreground"),
        },
        secondary: {
          DEFAULT: token("--secondary"),
          foreground: token("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: token("--destructive"),
          foreground: token("--destructive-foreground"),
        },
        muted: {
          DEFAULT: token("--muted"),
          foreground: token("--muted-foreground"),
        },
        accent: {
          DEFAULT: token("--accent"),
          foreground: token("--accent-foreground"),
        },
        popover: {
          DEFAULT: token("--popover"),
          foreground: token("--popover-foreground"),
        },
        card: {
          DEFAULT: token("--card"),
          foreground: token("--card-foreground"),
        },

        // --- Token espliciti del design system (docs/COACH_IA_DESIGN_SYSTEM.md) ---
        // Sfondi
        base: token("--bg-base"),
        surface: {
          DEFAULT: token("--bg-surface"),
          2: token("--bg-surface-2"),
        },
        // Riquadro annidato dentro una card: più BIANCO del contenitore.
        // Prima qui si usava `bg-base` e i campi risultavano più scuri della
        // card che li conteneva.
        nest: token("--glass-nest"),
        // Livello di testo senza equivalente shadcn:
        faint: token("--text-faint"),
        // Colori grezzi dell'identità, per i blocchi pieni (chip inchiostro,
        // pulsante lime) — non usarli per il testo: usa i token semantici.
        ink: token("--ink"),
        lime: token("--lime"),
        // Identità: lime pieno + inchiostro (command center).
        // `brand` = superficie lime; `brand-ink` = la versione LEGGIBILE come
        // testo (oliva sul chiaro, lime sullo scuro).
        brand: {
          DEFAULT: token("--brand"),
          hover: token("--brand-hover"),
          dim: token("--brand-dim"),
          on: token("--brand-on"),
          ink: token("--brand-ink"),
        },
        accent2: {
          DEFAULT: token("--accent-2"),
          hover: token("--accent-2-hover"),
          dim: token("--accent-2-dim"),
        },
        // Alias legacy dell'identità (nome mantenuto per compatibilità)
        amber: {
          DEFAULT: token("--amber"),
          hover: token("--amber-hover"),
          dim: token("--amber-dim"),
          on: token("--amber-on"),
        },
        telemetry: {
          blue: token("--accent-blue"),
          "blue-dim": token("--accent-blue-dim"),
          gold: token("--accent-gold"),
          "gold-dim": token("--accent-gold-dim"),
        },
        zone: {
          z1: token("--zone-z1"),
          z2: token("--zone-z2"),
          z3: token("--zone-z3"),
          z4: token("--zone-z4"),
          z5: token("--zone-z5"),
        },
        // Semaforico readiness (solo per stato/readiness)
        "ready-on": token("--ready-on"),
        "ready-go": {
          DEFAULT: token("--ready-go"),
          border: token("--ready-go-border"),
        },
        "ready-modify": {
          DEFAULT: token("--ready-modify"),
          border: token("--ready-modify-border"),
        },
        "ready-skip": {
          DEFAULT: token("--ready-skip"),
          border: token("--ready-skip-border"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "28px",
        metric: "20px",
      },
      // Un solo carattere: Manrope (command center). I nomi `serif`/`display`/
      // `data` restano per non toccare ~40 call site — indicano il ruolo
      // (titoli, numeri), non più un graziato.
      fontFamily: {
        display: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
        data: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
