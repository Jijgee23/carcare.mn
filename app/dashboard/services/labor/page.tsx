import { ServiceList } from "../service-list";

export const metadata = { title: "Ажил — Үйлчилгээ" };

export default async function LaborPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <ServiceList type="LABOR" pageParam={page} />;
}
