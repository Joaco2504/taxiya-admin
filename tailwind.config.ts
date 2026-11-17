import type { Config } from "tailwindcss";

/**
 * Paleta oficial TaxiYa (Daylight Mode y Night Shift Mode)
 * Definida en .agent/memory.md
 */
export const taxiyaPalette = {
  light: {
    background: "#F8FAFC",
    card: "#FFFFFF",
    border: "#E2E8F0",
    primary: "#F59E0B",
    primaryForeground: "#0F172A",
    secondary: "#0284C7",
    secondaryForeground: "#FFFFFF",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    success: "#16A34A",
    warning: "#EA580C",
    error: "#DC2626",
  },
  dark: {
    background: "#0B0F19",
    card: "#151C2C",
    border: "#263147",
    primary: "#FBBF24",
    primaryForeground: "#0B0F19",
    secondary: "#38BDF8",
    secondaryForeground: "#0B0F19",
    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    success: "#22C55E",
    warning: "#FB923C",
    error: "#F87171",
  },
} as const;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
    },
  },
  plugins: [],
};

export default config;
