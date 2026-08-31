-- CreateEnum
CREATE TYPE "FeedbackMessageAuthor" AS ENUM ('ADMIN', 'SUBMITTER');

-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "repliedAt",
DROP COLUMN "replyMessage";

-- CreateTable
CREATE TABLE "FeedbackMessage" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "tenantId" TEXT,
    "author" "FeedbackMessageAuthor" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackMessage_feedbackId_createdAt_idx" ON "FeedbackMessage"("feedbackId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackMessage_tenantId_idx" ON "FeedbackMessage"("tenantId");

-- AddForeignKey
ALTER TABLE "FeedbackMessage" ADD CONSTRAINT "FeedbackMessage_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackMessage" ADD CONSTRAINT "FeedbackMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: tenant_isolation policy (Feedback/Notification-той адил хэв маяг).
ALTER TABLE "FeedbackMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedbackMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FeedbackMessage"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
