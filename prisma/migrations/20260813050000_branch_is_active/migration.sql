-- Ажиллахаа больсон салбарыг "нуух" боломж (Branch устгах Restrict-оор хаалттай тул).
ALTER TABLE "Branch" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
