-- DiagnosticTemplate-д ангилал (Category) нэмнэ — бусад үйлчилгээтэй нэгэн адил.
ALTER TABLE "DiagnosticTemplate" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "DiagnosticTemplate_categoryId_idx" ON "DiagnosticTemplate"("categoryId");
ALTER TABLE "DiagnosticTemplate" ADD CONSTRAINT "DiagnosticTemplate_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
