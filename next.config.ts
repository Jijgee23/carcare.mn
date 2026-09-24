import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LAN-аас (утас, өөр төхөөрөмж) dev server-т хандах боломж. Зөвхөн hostname (protocol/port биш).
  allowedDevOrigins: ["192.168.88.114", "192.168.*", "10.*"],

  experimental: {
    serverActions: {
      // Лого зэрэг файлын upload-д default 1MB бага. Манай storage.ts 2MB-аар хязгаарласан.
      bodySizeLimit: "4mb",
    },
  },

  // Суурь хамгаалалтын header-үүд. Бүрэн CSP-г зориуд хойшлуулсан — inline
  // script/style-той хуудсуудыг эвдэх эрсдэлтэй тул тусад нь туршиж нэмнэ.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HTTP (dev/LAN) дээр browser үл тоомсорлоно — зөвхөн HTTPS-д үйлчилнэ.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
