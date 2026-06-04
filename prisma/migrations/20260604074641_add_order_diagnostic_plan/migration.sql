-- CreateTable
CREATE TABLE "OrderDiagnostic" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDiagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderDiagnostic_orderId_idx" ON "OrderDiagnostic"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDiagnostic_orderId_templateId_key" ON "OrderDiagnostic"("orderId", "templateId");

-- AddForeignKey
ALTER TABLE "OrderDiagnostic" ADD CONSTRAINT "OrderDiagnostic_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiagnostic" ADD CONSTRAINT "OrderDiagnostic_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DiagnosticTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
