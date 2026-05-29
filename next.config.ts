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
};

export default nextConfig;
