-- CreateEnum
CREATE TYPE "PlanLimitKind" AS ENUM ('COUNT', 'BOOLEAN');

-- CreateTable
CREATE TABLE "PlanLimit" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PlanLimitKind" NOT NULL DEFAULT 'COUNT',
    "intValue" INTEGER,
    "boolValue" BOOLEAN,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanLimit_plan_sortOrder_idx" ON "PlanLimit"("plan", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLimit_plan_code_key" ON "PlanLimit"("plan", "code");
