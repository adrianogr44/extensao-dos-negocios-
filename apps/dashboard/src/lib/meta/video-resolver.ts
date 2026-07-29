import { prisma } from '@/lib/prisma';
import { getFileUrl, downloadFile } from '@/lib/minio';
import * as path from 'path';
import * as os from 'os';

export interface ResolvedVideo {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes?: bigint;
  durationMs?: number;
}

export async function resolveVideoUrl(videoId: string): Promise<string> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video) {
    throw new Error(`Video não encontrado: ${videoId}`);
  }

  validateVideoForPublishing(video);

  const url = await getFileUrl(video.minioBucket, video.minioKey);
  console.log(`[VideoResolver] Resolved URL for video ${videoId}: ${url.substring(0, 100)}...`);

  return url;
}

export async function resolveVideoBuffer(videoId: string): Promise<Buffer> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video) {
    throw new Error(`Video não encontrado: ${videoId}`);
  }

  validateVideoForPublishing(video);

  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `video-${videoId}-${Date.now()}.mp4`);

  console.log(`[VideoResolver] Downloading video ${videoId} from ${video.minioBucket}/${video.minioKey}`);

  try {
    await downloadFile(video.minioBucket, video.minioKey, tempFile);

    const fs = await import('fs/promises');
    const buffer = await fs.readFile(tempFile);

    await fs.unlink(tempFile);

    console.log(`[VideoResolver] Downloaded ${buffer.length} bytes for video ${videoId}`);

    return buffer;
  } catch (error) {
    console.error(`[VideoResolver] Error downloading video ${videoId}:`, error);
    throw error;
  }
}

export async function getVideoMetadata(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video) {
    throw new Error(`Video não encontrado: ${videoId}`);
  }

  return {
    id: video.id,
    filename: video.filename,
    durationMs: video.durationMs,
    width: video.width,
    height: video.height,
    sizeBytes: video.sizeBytes,
    status: video.status,
  };
}

function validateVideoForPublishing(video: any): void {
  if (video.status !== 'completed') {
    throw new Error(
      `Video ${video.id} está com status "${video.status}", precisa estar "completed" para publicar`,
    );
  }

  if (!video.minioKey || !video.minioBucket) {
    throw new Error(`Video ${video.id} não tem referência válida ao MinIO (minioKey/minioBucket)`);
  }

  console.log(
    `[VideoResolver] Video ${video.id} validado: ${video.durationMs}ms, ${video.width}x${video.height}`,
  );
}
