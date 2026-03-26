// Download card images from CardRush and upload to S3
// Skips images that already exist in the bucket (one-time operation)

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { REQUEST_DELAY_MS } from "./config";
import type { WholesaleCard } from "./cardrush-mapper";

const DEFAULT_BUCKET = "jp-op-photos";
const REGION = "us-east-1";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Uses default credential chain: env vars → ~/.aws/credentials → SSO → IAM role
function getS3Client(): S3Client {
  return new S3Client({ region: REGION });
}

// S3 key: hires/{SET_CODE}/{SKU}.jpg  e.g. hires/OP01/OP-OP01-001-JP-V11L2.jpg
// Matches the output of scrape-all-onepiece-hires.py (full SKU, .jpg, hires/ prefix)
function s3Key(card: WholesaleCard): string {
  return `hires/${card.setCode}/${card.sku}.jpg`;
}

export function s3ImageUrl(card: WholesaleCard, bucket: string = DEFAULT_BUCKET): string {
  return `https://${bucket}.s3.${REGION}.amazonaws.com/${s3Key(card)}`;
}

async function objectExists(s3: S3Client, key: string, bucket: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/*",
      },
    });
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

export async function uploadImagesToS3(
  cards: WholesaleCard[],
  bucket: string = DEFAULT_BUCKET
): Promise<{ uploaded: number; skipped: number; failed: number }> {
  const s3 = getS3Client();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const card of cards) {
    const key = s3Key(card);

    // Skip if no source image
    if (!card.imageUrl) {
      console.log(`    ${card.sku}: no source image, skipping`);
      skipped++;
      continue;
    }

    // Skip if already in S3
    if (await objectExists(s3, key, bucket)) {
      skipped++;
      continue;
    }

    // Download from CardRush
    const imageData = await downloadImage(card.imageUrl);
    if (!imageData) {
      console.log(`    ${card.sku}: download failed`);
      failed++;
      continue;
    }

    // Upload to S3
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: imageData,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000",
          ACL: "public-read",
        })
      );
      uploaded++;
      console.log(`    ${card.sku}: uploaded (${(imageData.length / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.log(`    ${card.sku}: upload failed — ${err}`);
      failed++;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { uploaded, skipped, failed };
}
