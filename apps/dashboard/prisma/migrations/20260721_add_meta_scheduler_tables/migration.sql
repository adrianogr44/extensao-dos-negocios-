-- CreateTable MetaAccount
CREATE TABLE IF NOT EXISTS "MetaAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "facebookPageId" TEXT NOT NULL,
    "instagramAccountId" TEXT,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "refreshToken" TEXT,
    "pageName" TEXT NOT NULL,
    "pageUsername" TEXT,
    "profilePictureUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable PublicationTemplate
CREATE TABLE IF NOT EXISTS "PublicationTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY['FACEBOOK', 'INSTAGRAM']::text[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable Publication
CREATE TABLE IF NOT EXISTS "Publication" (
    "id" TEXT NOT NULL,
    "metaAccountId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "templateId" TEXT,
    "description" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY['FACEBOOK', 'INSTAGRAM']::text[],
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metaPostId" TEXT,
    "metaInsightsUrl" TEXT,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable PublicationLog
CREATE TABLE IF NOT EXISTS "PublicationLog" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metaResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex MetaAccount
CREATE UNIQUE INDEX IF NOT EXISTS "MetaAccount_facebookPageId_key" ON "MetaAccount"("facebookPageId");
CREATE INDEX IF NOT EXISTS "MetaAccount_userId_idx" ON "MetaAccount"("userId");
CREATE INDEX IF NOT EXISTS "MetaAccount_isActive_idx" ON "MetaAccount"("isActive");

-- CreateIndex PublicationTemplate
CREATE INDEX IF NOT EXISTS "PublicationTemplate_userId_idx" ON "PublicationTemplate"("userId");

-- CreateIndex Publication
CREATE UNIQUE INDEX IF NOT EXISTS "Publication_videoId_metaAccountId_scheduledFor_key" ON "Publication"("videoId", "metaAccountId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "Publication_metaAccountId_idx" ON "Publication"("metaAccountId");
CREATE INDEX IF NOT EXISTS "Publication_status_idx" ON "Publication"("status");
CREATE INDEX IF NOT EXISTS "Publication_scheduledFor_idx" ON "Publication"("scheduledFor");
CREATE INDEX IF NOT EXISTS "Publication_videoId_idx" ON "Publication"("videoId");
CREATE INDEX IF NOT EXISTS "Publication_templateId_idx" ON "Publication"("templateId");

-- CreateIndex PublicationLog
CREATE INDEX IF NOT EXISTS "PublicationLog_publicationId_idx" ON "PublicationLog"("publicationId");
CREATE INDEX IF NOT EXISTS "PublicationLog_createdAt_idx" ON "PublicationLog"("createdAt");

-- AddForeignKey Publication
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_metaAccountId_fkey" FOREIGN KEY ("metaAccountId") REFERENCES "MetaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PublicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey PublicationLog
ALTER TABLE "PublicationLog" ADD CONSTRAINT "PublicationLog_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
