/**
 * Анхны super admin-ыг үүсгэх CLI script.
 *
 * Ажиллуулах:
 *   npm run system:create-admin -- <email> <password> <firstName> <lastName>
 * Жишээ:
 *   npm run system:create-admin -- root@carcare.mn supersecret123 Бат Болд
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
  const existing = await prisma.superAdmin.count();
  if (existing > 0) {
    console.error(
      `Аль хэдийн ${existing} super admin бүртгэлтэй байна. V1 нь зөвхөн нэг admin-ыг дэмжинэ.`,
    );
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
