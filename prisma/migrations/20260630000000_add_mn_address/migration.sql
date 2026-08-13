-- Монголын засаг захиргааны нэгжийн лавлах хүснэгтүүд (City → District → Khoroo).
-- Өгөгдлийг scripts/mongolian.sql-аас seed-ээр ачаална.

CREATE TABLE "City" (
    "id" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "District" (
    "id" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT,
    "cityId" INTEGER,
    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Khoroo" (
    "id" INTEGER NOT NULL,
    "name" TEXT,
    "cityId" INTEGER,
    "districtId" INTEGER,
    CONSTRAINT "Khoroo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "District_cityId_idx" ON "District"("cityId");
CREATE INDEX "Khoroo_cityId_idx" ON "Khoroo"("cityId");
CREATE INDEX "Khoroo_districtId_idx" ON "Khoroo"("districtId");

ALTER TABLE "District" ADD CONSTRAINT "District_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Khoroo" ADD CONSTRAINT "Khoroo_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Khoroo" ADD CONSTRAINT "Khoroo_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;
