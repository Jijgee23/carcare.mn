-- DropForeignKey
ALTER TABLE "BranchCategoryDuration" DROP CONSTRAINT "BranchCategoryDuration_branchId_fkey";

-- DropForeignKey
ALTER TABLE "BranchCategoryDuration" DROP CONSTRAINT "BranchCategoryDuration_categoryId_fkey";

-- DropTable
DROP TABLE "BranchCategoryDuration";
