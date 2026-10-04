-- CreateTable
CREATE TABLE "BrandAsset" (
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("key")
);
