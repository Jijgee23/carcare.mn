-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "replyMessage" TEXT,
ADD COLUMN     "screenshotUrl" TEXT;
