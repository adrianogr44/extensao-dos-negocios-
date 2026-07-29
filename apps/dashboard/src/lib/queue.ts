import { Queue, Worker } from 'bullmq'

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? Number(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
}

export const renderQueue = new Queue('video-render', { connection })

export async function addRenderJob(videoId: string, batchId?: string) {
  return renderQueue.add('render', { videoId, batchId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
