-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "bodyMdAr" TEXT,
ADD COLUMN     "objectivesAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videoScriptAr" TEXT,
ADD COLUMN     "videoScriptEn" TEXT;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'all';
