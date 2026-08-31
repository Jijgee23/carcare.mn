import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { formatAddress, formatWorkDays } from "@/lib/branches";
import { prisma } from "@/lib/prisma";
import { buildBranchWhere, type BranchStatusFilter } from "../data";

// GET /dashboard/branches/export?q=&status=active|inactive
// Одоогийн шүүлтүүртэй нийцсэн салбаруудыг .xlsx болгож татна.
export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status");
  const status: BranchStatusFilter =
    statusParam === "active" || statusParam === "inactive" ? statusParam : undefined;

  const branches = await prisma.branch.findMany({
    where: buildBranchWhere(user.tenantId, q, status),
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { users: true, serviceOrders: true } },
      schedules: { select: { weekday: true, isOpen: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "carcare.mn";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Салбарууд");
  sheet.columns = [
    { header: "Нэр", key: "name", width: 24 },
    { header: "Хаяг", key: "address", width: 36 },
    { header: "Цаг", key: "hours", width: 14 },
    { header: "Ажиллах өдөр", key: "days", width: 20 },
    { header: "Утас", key: "phone", width: 14 },
    { header: "Ажилтан", key: "staff", width: 10 },
    { header: "Захиалга", key: "orders", width: 10 },
    { header: "Үндсэн", key: "primary", width: 10 },
    { header: "Төлөв", key: "status", width: 12 },
  ];
  sheet.addRows(
    branches.map((b) => ({
      name: b.name,
      address: formatAddress(b),
      hours: b.openTime && b.closeTime ? `${b.openTime}–${b.closeTime}` : "—",
      days: formatWorkDays(b.schedules),
      phone: b.phone ?? "—",
      staff: b._count.users,
      orders: b._count.serviceOrders,
      primary: b.isPrimary ? "Тийм" : "",
      status: b.isActive ? "Идэвхтэй" : "Идэвхгүй",
    })),
  );
  sheet.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="salbaruud_${stamp}.xlsx"`,
    },
  });
}
