-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "renewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "validityMonths" INTEGER;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "renewalSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "audienceId" TEXT,
    "autoAssignNewHires" BOOLEAN NOT NULL DEFAULT false,
    "dueDays" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPathCourse" (
    "pathId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "LearningPathCourse_pkey" PRIMARY KEY ("pathId","courseId")
);

-- CreateTable
CREATE TABLE "PathEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PathEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DailyAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_slug_key" ON "LearningPath"("slug");

-- CreateIndex
CREATE INDEX "LearningPathCourse_courseId_idx" ON "LearningPathCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PathEnrollment_userId_pathId_key" ON "PathEnrollment"("userId", "pathId");

-- CreateIndex
CREATE INDEX "ReminderLog_createdAt_idx" ON "ReminderLog"("createdAt");

-- CreateIndex
CREATE INDEX "DailyAnswer_day_idx" ON "DailyAnswer"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAnswer_userId_day_key" ON "DailyAnswer"("userId", "day");

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathCourse" ADD CONSTRAINT "LearningPathCourse_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathCourse" ADD CONSTRAINT "LearningPathCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathEnrollment" ADD CONSTRAINT "PathEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathEnrollment" ADD CONSTRAINT "PathEnrollment_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAnswer" ADD CONSTRAINT "DailyAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
