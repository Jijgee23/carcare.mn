-- RefreshToken.replacedById-г өөрийгөө ишлэсэн (self) FK relation болгож rotation хэлхээг найдвартай болгоно.
-- Нэг шинэ token зөвхөн нэг хуучин token-той холбогдоно тул unique.
CREATE UNIQUE INDEX "RefreshToken_replacedById_key" ON "RefreshToken"("replacedById");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey"
  FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
