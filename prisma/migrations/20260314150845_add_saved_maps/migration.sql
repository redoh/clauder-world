-- CreateTable
CREATE TABLE "savedMap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mapData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savedMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "savedMap_userId_idx" ON "savedMap"("userId");

-- AddForeignKey
ALTER TABLE "savedMap" ADD CONSTRAINT "savedMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
