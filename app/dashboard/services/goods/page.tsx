import { ServiceList } from "../service-list";

export const metadata = { title: "Сэлбэг / Бараа — Үйлчилгээ" };

export default async function GoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <ServiceList type="GOODS" pageParam={page} />;
}
