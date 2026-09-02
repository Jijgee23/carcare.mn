import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildEmployeeWhere, type EmployeeStatusFilter } from "../data";

// GET /dashboard/employees/export?q=&roleId=&branchId=&status=active|inactive|temp|expired
// Одоогийн шүүлтүүртэй нийцсэн ажилтнуудыг .xlsx болгож татна.
export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const roleId = searchParams.get("roleId") ?? "";
  const branchId = searchParams.get("branchId") ?? "";
  const statusParam = searchParams.get("status");
  const status: EmployeeStatusFilter =
    statusParam === "active" ||
    statusParam === "inactive" ||
    statusParam === "temp" ||
    statusParam === "expired"
      ? statusParam
      : undefined;

  const employees = await prisma.user.findMany({
    where: buildEmployeeWhere(user.tenantId, q, roleId, branchId, status),
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
    include: {
      branch: { select: { name: true } },
      role: { select: { name: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "carservice.mn";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Ажилтнууд");
  sheet.columns = [
    { header: "Овог", key: "lastName", width: 16 },
    { header: "Нэр", key: "firstName", width: 16 },
    { header: "Имэйл", key: "email", width: 26 },
    { header: "Утас", key: "phone", width: 14 },
    { header: "Үүрэг", key: "role", width: 18 },
    { header: "Салбар", key: "branch", width: 20 },
    { header: "Идэвхжсэн", key: "verified", width: 12 },
    { header: "Төлөв", key: "status", width: 16 },
    { header: "Хугацаа", key: "activeUntil", width: 14 },
    { header: "Бүртгэсэн", key: "createdAt", width: 14 },
  ];

  const now = Date.now();
  sheet.addRows(
    employees.map((u) => {
      const expired = u.activeUntil != null && u.activeUntil.getTime() <= now;
      const status = !u.isActive
        ? "Идэвхгүй"
        : expired
          ? "Хугацаа дууссан"
          : u.activeUntil
            ? "Түр"
            : "Идэвхтэй";
      return {
        lastName: u.lastName,
        firstName: u.firstName,
        email: u.email,
        phone: u.phone,
        role: u.isOwner ? "Админ" : (u.role?.name ?? "—"),
        branch: u.branch?.name ?? "—",
        verified: u.verified ? "Тийм" : "Үгүй",
        status,
        activeUntil: u.activeUntil ? u.activeUntil.toLocaleDateString("mn-MN") : "—",
        createdAt: u.createdAt.toLocaleDateString("mn-MN"),
      };
    }),
  );
  sheet.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ajiltnuud_${stamp}.xlsx"`,
    },
  });
}
