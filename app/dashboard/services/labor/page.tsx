import { ServiceList } from "../service-list";

export const metadata = { title: "Ажил — Үйлчилгээ" };

export default async function LaborPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string }>;
}) {
  const { page, sort, dir } = await searchParams;
  return <ServiceList type="LABOR" pageParam={page} sortParam={sort} dirParam={dir} />;
}
