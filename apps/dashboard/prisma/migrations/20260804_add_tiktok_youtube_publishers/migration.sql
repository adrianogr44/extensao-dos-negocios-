-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "tiktokAccountId" TEXT,
ADD COLUMN     "youtubeAccountId" TEXT,
ALTER COLUMN "metaAccountId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TiktokAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "profilePictureUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TiktokAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiktokSession" (
    "id" TEXT NOT NULL,
    "tiktokAccountId" TEXT,
    "encryptedCookies" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "loggedInAs" TEXT,
    "ttUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TiktokSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channelName" TEXT NOT NULL,
    "channelId" TEXT,
    "profilePictureUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeSession" (
    "id" TEXT NOT NULL,
    "youtubeAccountId" TEXT,
    "encryptedCookies" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "loggedInAs" TEXT,
    "googleUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TiktokAccount_userId_idx" ON "TiktokAccount"("userId");

-- CreateIndex
CREATE INDEX "TiktokAccount_isActive_idx" ON "TiktokAccount"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TiktokAccount_username_key" ON "TiktokAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "TiktokSession_tiktokAccountId_key" ON "TiktokSession"("tiktokAccountId");

-- CreateIndex
CREATE INDEX "TiktokSession_status_idx" ON "TiktokSession"("status");

-- CreateIndex
CREATE INDEX "YoutubeAccount_userId_idx" ON "YoutubeAccount"("userId");

-- CreateIndex
CREATE INDEX "YoutubeAccount_isActive_idx" ON "YoutubeAccount"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeSession_youtubeAccountId_key" ON "YoutubeSession"("youtubeAccountId");

-- CreateIndex
CREATE INDEX "YoutubeSession_status_idx" ON "YoutubeSession"("status");

-- CreateIndex
CREATE INDEX "Publication_tiktokAccountId_idx" ON "Publication"("tiktokAccountId");

-- CreateIndex
CREATE INDEX "Publication_youtubeAccountId_idx" ON "Publication"("youtubeAccountId");

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_tiktokAccountId_fkey" FOREIGN KEY ("tiktokAccountId") REFERENCES "TiktokAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_youtubeAccountId_fkey" FOREIGN KEY ("youtubeAccountId") REFERENCES "YoutubeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiktokSession" ADD CONSTRAINT "TiktokSession_tiktokAccountId_fkey" FOREIGN KEY ("tiktokAccountId") REFERENCES "TiktokAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeSession" ADD CONSTRAINT "YoutubeSession_youtubeAccountId_fkey" FOREIGN KEY ("youtubeAccountId") REFERENCES "YoutubeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

