import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://carcare.mn"),
  title: {
    default: "carcare.mn — Авто үйлчилгээний ухаалаг платформ",
    template: "%s · carcare.mn",
  },
  description:
    "Автомашины оношилгоо, засвар үйлчилгээ эрхэлдэг байгууллагуудад зориулсан олон салбарын PaaS. Захиалга, түүх, нөөц, тайлан — нэг дороос.",
  keywords: [
    "carcare",
    "carcare.mn",
    "авто засвар",
    "авто оношилгоо",
    "сервис менежмент",
    "OBD",
    "Mongolia",
  ],
  // Icon-уудыг файлын конвенцоор (app/favicon.ico, app/icon.png,
  // app/apple-icon.png) Next автоматаар <head>-д нэмнэ.
  openGraph: {
    title: "carcare.mn — Авто үйлчилгээний ухаалаг платформ",
    description:
      "Олон салбарт ажиллах сервис төвүүдэд зориулсан орчин үеийн PaaS систем.",
    url: "https://carcare.mn",
    siteName: "carcare.mn",
    locale: "mn_MN",
    type: "website",
    // icon: [
    //   { url: "/favicon.ico", type: "image/x-icon" },
    //   { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    //   { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    // ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" className={`${geist.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col bg-[#0a0a0f] text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
