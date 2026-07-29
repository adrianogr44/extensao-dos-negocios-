import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { writeFile } from 'node:fs/promises'

function getClient() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  })
}

export async function ensureBuckets() {
  const client = getClient()
  const { Buckets } = await client.send(new ListBucketsCommand({}))
  const existing = new Set(Buckets?.map(b => b.Name) || [])
  const needed = ['postreels-downloads', 'postreels-renders', 'postreels-overlays']

  for (const bucket of needed) {
    if (!existing.has(bucket)) {
      const { CreateBucketCommand } = await import('@aws-sdk/client-s3')
      await client.send(new CreateBucketCommand({ Bucket: bucket }))
    }
  }
}

export async function uploadFile(bucket: string, key: string, body: Buffer | Blob, contentType?: string) {
  const client = getClient()
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  })
  return upload.done()
}

export async function getFileStream(bucket: string, key: string) {
  const client = getClient()
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return result.Body
}

export async function getFileUrl(bucket: string, key: string) {
  return `${process.env.S3_ENDPOINT}/${bucket}/${key}`
}

export async function downloadFile(bucket: string, key: string, outputPath: string) {
  const client = getClient()
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))

  if (!result.Body) {
    throw new Error(`No body in response for ${bucket}/${key}`)
  }

  // Converter stream para buffer
  const chunks: Buffer[] = []
  for await (const chunk of result.Body as any) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk))
  }

  const buffer = Buffer.concat(chunks)
  await writeFile(outputPath, buffer)

  return buffer.length
}

export async function deleteFile(bucket: string, key: string) {
  const client = getClient()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
