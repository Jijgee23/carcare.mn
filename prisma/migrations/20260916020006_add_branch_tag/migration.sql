-- CreateTable
CREATE TABLE "BranchTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BranchToBranchTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BranchToBranchTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchTag_name_key" ON "BranchTag"("name");

-- CreateIndex
CREATE INDEX "BranchTag_isActive_idx" ON "BranchTag"("isActive");

-- CreateIndex
CREATE INDEX "_BranchToBranchTag_B_index" ON "_BranchToBranchTag"("B");

-- AddForeignKey
ALTER TABLE "BranchTag" ADD CONSTRAINT "BranchTag_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToBranchTag" ADD CONSTRAINT "_BranchToBranchTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToBranchTag" ADD CONSTRAINT "_BranchToBranchTag_B_fkey" FOREIGN KEY ("B") REFERENCES "BranchTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
