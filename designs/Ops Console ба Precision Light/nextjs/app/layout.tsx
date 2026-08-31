import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "carcare.mn — Автосервисийн ажлыг нэг урсгал болгоно",
  description:
    "Засварын газруудад захиалга, ажлын хуваарь, нөөц, тайлан; жолоочид цаг товлолт, засварын түүх — нэг платформ дээр.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
