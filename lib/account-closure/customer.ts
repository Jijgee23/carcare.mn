import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import { accountTombstone } from "./tombstone";

// Түр хаах: token-ууд getApiAccountFromRequest-д хүчингүй болно (deactivatedAt).
// Push илгээгдэхгүйн тулд device-уудыг устгана; дахин нэвтрэхэд апп дахин бүртгэнэ.
export async function deactivateAccount(accountId: string): Promise<void> {
  await prisma.$transaction([
    prisma.account.update({ where: { id: accountId }, data: { deactivatedAt: new Date() } }),
    prisma.device.deleteMany({ where: { accountId } }),
  ]);
}

// Бүрмөсөн устгах — буцаагдахгүй. Тенантын Customer бичлэг (гаражийн өөрийн
// CRM) хадгалагдаж, зөвхөн Account-аас салгагдана. Appointment/payment/feedback
// tombstone Account-той холбоотой үлдэнэ.
export async function deleteAccount(accountId: string): Promise<void> {
  // Customer нь tenant-scoped (RLS) — Account-ийн Customer-ууд олон тенантад
  // тархсан байж болно тул энд bypass шаардлагатай (getApiAccountFromRequest
  // аль хэдийн bypass тавьсан ч дуудагч бие даан ачаалагдвал алга болно).
  setBypassContext();
  await prisma.$transaction([
    prisma.customer.updateMany({ where: { accountId }, data: { accountId: null } }),
    // Appointment/Feedback-ийг Account-аас салгана — эс тэгвэл tombstone-ийн
    // "deleted:<id>" утас (null биш) гараж руу дэлгэц дээр гоожно.
    prisma.appointment.updateMany({ where: { accountId }, data: { accountId: null } }),
    prisma.feedback.updateMany({ where: { accountId }, data: { accountId: null } }),
    prisma.device.deleteMany({ where: { accountId } }),
    prisma.notification.deleteMany({ where: { accountId } }),
    prisma.accountVehicle.deleteMany({ where: { accountId } }),
    prisma.account.update({ where: { id: accountId }, data: accountTombstone(accountId, new Date()) }),
  ]);
}
