-- Customer.phone-ийг канон 8 оронтой формат руу нормчилно (lib/phone.ts-тэй ижил дүрэм).
-- Account ↔ Customer тааралт утсаар түлхүүрлэгддэг тул "+976...", "9911-2233",
-- "09911..." зэрэг хуучин форматтай бичлэгүүд тааралтад унадаг байсныг засна.
--
-- Дүрэм: тоо биш тэмдэгтийг хасна → 11 орон, 976-аар эхэлбэл 976-г хасна →
-- 9 орон, 0-ээр эхэлбэл 0-г хасна. Үр дүн 5-9-өөр эхэлсэн 8 орон болсон үед л
-- шинэчилнэ (бусад нь гараар шалгах шаардлагатай тул хөндөхгүй).

WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN length(digits) = 11 AND digits LIKE '976%' THEN substr(digits, 4)
      WHEN length(digits) = 9 AND digits LIKE '0%' THEN substr(digits, 2)
      ELSE digits
    END AS canon
  FROM (
    SELECT id, regexp_replace(phone, '\D', '', 'g') AS digits
    FROM "Customer"
  ) d
)
UPDATE "Customer" c
SET phone = n.canon
FROM normalized n
WHERE c.id = n.id
  AND n.canon ~ '^[5-9]\d{7}$'
  AND c.phone <> n.canon;
