-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "drawCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "optionOrder" JSONB,
ADD COLUMN     "questionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
