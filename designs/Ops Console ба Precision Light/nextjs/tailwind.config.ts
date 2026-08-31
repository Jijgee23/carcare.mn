import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        carbon: "#0B0D10",
        panel: "#0E1116",
        panel2: "#101318",
        line: "#23272E",
        line2: "#191D23",
        ink: "#F4F5F7",
        ink2: "#EDEEF0",
        muted: "#A7ADB6",
        muted2: "#8A8F98",
        muted3: "#6E747E",
        muted4: "#4A4D54",
        accent: "#F5A524",
        accentHi: "#FFC65C",
        ok: "#3DDC97",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      backgroundImage: {
        grid:
          "linear-gradient(#14181D 1px, transparent 1px), linear-gradient(90deg, #14181D 1px, transparent 1px)",
      },
      backgroundSize: { grid: "72px 72px" },
    },
  },
  plugins: [],
} satisfies Config;
