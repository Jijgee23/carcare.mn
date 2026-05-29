import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  redirect(`/dashboard/diagnostics/reports/${reportId}`);
}
