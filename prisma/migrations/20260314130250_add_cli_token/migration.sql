-- CreateTable
CREATE TABLE "cliToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliToken_userId_key" ON "cliToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cliToken_token_key" ON "cliToken"("token");

-- AddForeignKey
ALTER TABLE "cliToken" ADD CONSTRAINT "cliToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
