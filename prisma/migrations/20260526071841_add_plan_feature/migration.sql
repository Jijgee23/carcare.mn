-- CreateTable
CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanFeature_plan_sortOrder_idx" ON "PlanFeature"("plan", "sortOrder");
