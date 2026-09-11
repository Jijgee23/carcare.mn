/**
 * Анхны super admin-ыг үүсгэх CLI script.
 *
 * Ажиллуулах:
 *   npm run system:create-admin -- <email> <password> <firstName> <lastName>
 * Жишээ:
 *   npm run system:create-admin -- root@carservice.mn supersecret123 Бат Болд
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error(
    "Хэрэглээ: npm run system:create-admin -- <email> <password> <firstName> <lastName>",
  );
  process.exit(1);
}

const [email, password, firstName, ...lastParts] = args;
const lastName = lastParts.join(" ");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Имэйл хаяг буруу.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL орчны хувьсагч тохируулагдаагүй.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {
  // V2: олон super admin дэмжинэ (харах: app/system/(authed)/admins/) — энэ
  // script ихэвчлэн ХАМГИЙН ЭХНИЙ (bootstrap) admin-ыг үүсгэхэд хэрэглэгдэнэ,
  // учир нь нэг ч admin байхгүй үед аппаас нэвтэрч урих боломжгүй. Дараагийн
  // admin-уудыг /system/admins хуудаснаас урих нь илүү тохиромжтой (аль
  // admin урьсныг хадгална), гэхдээ энэ script-ийг ч давтан ажиллуулж болно.
  const existing = await prisma.superAdmin.count();
  if (existing > 0) {
    console.log(
      `\n⚠ Аль хэдийн ${existing} super admin бүртгэлтэй байна — үргэлжлүүлж шинийг нэмж байна.`,
    );
  }

  const dup = await prisma.superAdmin.findUnique({ where: { email } });
  if (dup) {
    console.error(`Энэ имэйлтэй admin аль хэдийн байна: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.superAdmin.create({
    data: { email, firstName, lastName, passwordHash },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  console.log("\n✔ Super admin амжилттай үүсгэгдлээ:");
  console.log(`  ID:    ${admin.id}`);
  console.log(`  Имэйл: ${admin.email}`);
  console.log(`  Нэр:   ${admin.lastName} ${admin.firstName}`);
  console.log("\n  Нэвтрэх: /system/login");
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
