-- Энэ migration-аас өмнө үүссэн бүх ажилтан нууц үгтэй байсан тул аль хэдийн
-- баталгаажсан гэж үзнэ. verified-г true болгож тэднийг түгжихээс сэргийлнэ.
-- (Шинэ ажилтнууд verified=false-аар үүсэж, OTP-ээр идэвхжинэ.)
UPDATE "User" SET "verified" = true WHERE "passwordHash" IS NOT NULL;