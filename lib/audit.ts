import { Prisma, type PrismaClient } from "@/app/generated/prisma/client";
import { prisma } from "./prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "PAYMENT_CHANGE"
  | "STOCK_CHANGE"
  | "ITEM_ADDED"
  | "ITEM_REMOVED"
  | "ITEM_UPDATED"
  | "LOGIN"
  | "LOGOUT"
  | "OTHER";

export type AuditInput = {
  tenantId: string;
  entity: string;
  entityId: string;
  action: AuditAction;
  summary?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  userId?: string | null;
  branchId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// $transaction-н дотор зэрэг үүсгэх боломжтой болгох үүднээс client-ийг
// сонголтоор авдаг (default — глобал prisma).
type Client = PrismaClient | Prisma.TransactionClient;

/**
 * AuditLog бичлэг үүсгэнэ. Үндсэн үйлдлийн транзакцийн дотроос дуудах нь
 * хамгийн зөв — ингэснээр үндсэн өөрчлөлт rollback болсон үед лог үлдэхгүй.
 *
 * Алдаа гарвал шидэхгүй (warn хийгээд үргэлжлүүлнэ) — аудит лог нь үндсэн
 * үйлдлийн хариуцлагыг тасалдуулахгүй байх ёстой.
 */
export async function logAudit(
  input: AuditInput,
  client: Client = prisma,
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        tenantId: input.tenantId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        summary: input.summary ?? null,
        before: input.before ?? Prisma.DbNull,
        after: input.after ?? Prisma.DbNull,
        userId: input.userId ?? null,
        branchId: input.branchId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Аудит лог унавал үндсэн үйлдлийг алдагдуулахгүй
    console.warn("[audit] log failed:", err);
  }
}
