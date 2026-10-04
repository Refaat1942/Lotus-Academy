-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "requireCheckpoint" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "LessonCheckpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "questionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "passedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonCheckpoint_userId_lessonId_key" ON "LessonCheckpoint"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "LessonCheckpoint" ADD CONSTRAINT "LessonCheckpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCheckpoint" ADD CONSTRAINT "LessonCheckpoint_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
