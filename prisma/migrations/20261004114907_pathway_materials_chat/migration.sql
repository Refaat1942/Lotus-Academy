-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('FILE', 'LINK');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "sequential" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CourseModule" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "descriptionEn" TEXT;

-- AlterTable
ALTER TABLE "LessonAsset" ADD COLUMN     "fileId" TEXT,
ADD COLUMN     "kind" "AssetKind" NOT NULL DEFAULT 'LINK',
ALTER COLUMN "url" SET DEFAULT '';

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_userId_courseId_createdAt_idx" ON "ChatMessage"("userId", "courseId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
