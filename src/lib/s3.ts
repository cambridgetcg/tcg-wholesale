import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-west-2" });

export async function fetchPriceFeed(): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET || "pricedata-tcg",
    Key: process.env.S3_PRICE_FEED_KEY || "pricefeed/onepiece_pricefeed.xlsx",
  });
  const response = await s3.send(command);
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
