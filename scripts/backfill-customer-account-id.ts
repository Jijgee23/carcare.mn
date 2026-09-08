/**
 * `quickCreateCustomerAction`/`createCustomerAction` эрт хувилбарт утасны
 * дугаараар онлайн Account хайж холбодоггүй байсан тул ажилтны шууд
 * бүртгэсэн Customer-ууд (accountId=null) хожим тухайн хэрэглэгч бүртгүүлсэн
 * ч гүүрлэгдээгүй үлдсэн — харилцагчийн апп/веб дээр "Миний цагууд"/
 * "Захиалгууд"-д харагдахгүй байсны үндэс. Энэ нэг удаагийн скрипт
 * тэдгээрийг гар аргаар засварлана.
 *
 * Логик: Customer.accountId IS NULL, харин Customer.phone-той таарах
 * Account олдвол, ТУХАЙН tenant-д уг Account-д зориулсан өөр Customer
 * (@@unique([tenantId, accountId])) байхгүй л бол → Customer.accountId-г
 * тухайн Account.id-оор дүүргэнэ. Зөрчил (тухайн tenant-д уг Account-д
 * зориулсан өөр Customer аль хэдийн байгаа) үед алгасаж, тайланд дурдана —
 * гар аргаар нэгтгэх шаардлагатай тул автоматаар шийдэхгүй.
 *
 * Эхлээд тоолж хараарай (dry-run, өөрчлөлт хийхгүй):
 *   npx tsx scripts/backfill-customer-account-id.ts --dry-run
 *
 * Дараа нь бодитоор гүйцэтгэх бол:
 *   npx tsx scripts/backfill-customer-account-id.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Бүх tenant дундуур bulk update хийдэг скрипт тул RLS-г тойрч гарна.
  setBypassContext();

  const unclaimed = await prisma.customer.findMany({
    where: { accountId: null },
    select: { id: true, tenantId: true, phone: true, fullName: true },
  });

  if (unclaimed.length === 0) {
    console.log("✔ Шалгах эзэнгүй үйлчлүүлэгч алга.");
    return;
  }

  const toUpdate: { customerId: string; tenantId: string; accountId: string }[] = [];
  const conflicts: { customerId: string; tenantId: string; accountId: string }[] = [];

  for (const c of unclaimed) {
    const account = await prisma.account.findUnique({
      where: { phone: c.phone },
      select: { id: true },
    });
    if (!account) continue;

    const existingForAccount = await prisma.customer.findUnique({
      where: { tenantId_accountId: { tenantId: c.tenantId, accountId: account.id } },
      select: { id: true },
    });
    if (existingForAccount) {
      conflicts.push({ customerId: c.id, tenantId: c.tenantId, accountId: account.id });
      continue;
    }

    toUpdate.push({ customerId: c.id, tenantId: c.tenantId, accountId: account.id });
  }

  if (toUpdate.length === 0 && conflicts.length === 0) {
    console.log("✔ Утас тохирох Account олдсонгүй — засах зүйл алга.");
    return;
  }

  console.log(`Холбох: ${toUpdate.length} үйлчлүүлэгч.`);
  for (const u of toUpdate) {
    console.log(`  - ${u.customerId} (tenant ${u.tenantId}) → accountId=${u.accountId}`);
  }
  if (conflicts.length > 0) {
    console.log(
      `\nЗөрчилтэй (гар аргаар шалгах шаардлагатай, алгассан): ${conflicts.length}`,
    );
    for (const c of conflicts) {
      console.log(
        `  - ${c.customerId} (tenant ${c.tenantId}) — энэ tenant-д Account ${c.accountId}-д зориулсан өөр Customer аль хэдийн бий.`,
      );
    }
  }

  if (dryRun) {
    console.log("\n--dry-run тул өөрчлөлт хийгдээгүй.");
    return;
  }

  let updated = 0;
  for (const u of toUpdate) {
    await prisma.customer.update({
      where: { id: u.customerId },
      data: { accountId: u.accountId },
    });
    updated += 1;
  }
  console.log(`✔ ${updated} үйлчлүүлэгчийг холбогдох Account-тай гүүрлэлээ.`);
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
