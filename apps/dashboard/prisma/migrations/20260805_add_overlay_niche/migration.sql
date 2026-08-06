-- AlterTable
ALTER TABLE "Overlay" ADD COLUMN     "nicheId" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex  (via db push; documented here for reproducibility)
CREATE INDEX "Overlay_nicheId_idx" ON "Overlay"("nicheId");
CREATE INDEX "Overlay_isDefault_idx" ON "Overlay"("isDefault");

-- AlterTable
ALTER TABLE "EditConfig" ADD COLUMN     "overlayId" TEXT,
ADD COLUMN     "overlayBehind" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Overlay" ADD CONSTRAINT "Overlay_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditConfig" ADD CONSTRAINT "EditConfig_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay"("id") ON DELETE SET NULL ON UPDATE CASCADE;