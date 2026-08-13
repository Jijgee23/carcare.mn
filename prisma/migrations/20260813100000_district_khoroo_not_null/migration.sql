-- District.name/cityId, Khoroo.name/cityId — эх өгөгдөлд (scripts/mongolian.sql)
-- NULL байхгүйг баталгаажуулсны дараа NOT NULL болгоно. Khoroo.districtId
-- заавал биш хэвээр (зарим аймаг шууд аймагт харьяалагдана, бодит бүтэц).
ALTER TABLE "District" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "District" ALTER COLUMN "cityId" SET NOT NULL;

ALTER TABLE "Khoroo" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "Khoroo" ALTER COLUMN "cityId" SET NOT NULL;
