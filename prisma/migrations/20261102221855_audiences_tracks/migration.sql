-- CreateEnum
CREATE TYPE "CourseVisibility" AS ENUM ('ALL', 'AUDIENCE');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "visibility" "CourseVisibility" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "dueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "area" TEXT,
ADD COLUMN     "audienceId" TEXT,
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Audience" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAudience" (
    "courseId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "dueDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAudience_pkey" PRIMARY KEY ("courseId","audienceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Audience_key_key" ON "Audience"("key");

-- CreateIndex
CREATE INDEX "CourseAudience_audienceId_idx" ON "CourseAudience"("audienceId");

-- CreateIndex
CREATE INDEX "User_audienceId_idx" ON "User"("audienceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAudience" ADD CONSTRAINT "CourseAudience_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAudience" ADD CONSTRAINT "CourseAudience_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
