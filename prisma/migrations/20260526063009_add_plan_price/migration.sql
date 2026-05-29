-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTH', 'QUARTER', 'YEAR');

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "period" "BillingPeriod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MNT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanPrice_isActive_idx" ON "PlanPrice"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPrice_plan_period_currency_key" ON "PlanPrice"("plan", "period", "currency");
