import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/auth/session";
import { setBypassContext } from "@/lib/tenant-context";

async function main() {
  setBypassContext();
  const user = await prisma.user.findFirst({
    where: { isOwner: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error("No owner user found");
  const customer = await prisma.customer.findFirst({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "asc" } });
  const vehicle = await prisma.tenantVehicle.findFirst({ where: { tenantId: user.tenantId }, select: { vehicleId: true } });
  const service = await prisma.service.findFirst({ where: { tenantId: user.tenantId, type: "LABOR" }, orderBy: { createdAt: "asc" } });
  const diagTemplate = await prisma.diagnosticTemplate.findFirst({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "asc" } });
  const diagReport = await prisma.diagnosticReport.findFirst({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" } });
  const appt = await prisma.appointment.findFirst({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" } }).catch(() => null);
  const feedback = await prisma.feedback.findFirst({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" } }).catch(() => null);
  const token = await signSession({
    userId: user.id,
    tenantId: user.tenantId,
    isOwner: user.isOwner,
  });
  console.log(token);
  console.log(customer?.id ?? "");
  console.log(vehicle?.vehicleId ?? "");
  console.log(service?.id ?? "");
  console.log(diagTemplate?.id ?? "");
  console.log(diagReport?.id ?? "");
  console.log(appt?.id ?? "");
  console.log(feedback?.id ?? "");
  await prisma.$disconnect();
}

main();
