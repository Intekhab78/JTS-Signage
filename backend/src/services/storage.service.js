const fs = require("fs");
const path = require("path");

const getStorageProvider = () =>
  (process.env.STORAGE_PROVIDER || "local").toLowerCase();

const getS3ClientAndCommands = () => {
  let sdk;
  try {
    sdk = require("@aws-sdk/client-s3");
  } catch {
    throw new Error(
      "S3 storage selected but @aws-sdk/client-s3 is not installed"
    );
  }

  const { S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } =
    process.env;

  if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "Missing required S3 configuration (S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)"
    );
  }

  const client = new sdk.S3Client({
    region: S3_REGION,
    ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT } : {}),
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });

  return {
    client,
    bucket: S3_BUCKET,
    region: S3_REGION,
    PutObjectCommand: sdk.PutObjectCommand,
    DeleteObjectCommand: sdk.DeleteObjectCommand,
  };
};

exports.saveVideo = async (file) => {
  if (!file) {
    throw new Error("Video file is required");
  }

  const provider = getStorageProvider();

  if (provider === "local") {
    return `/uploads/videos/${file.filename}`;
  }

  if (provider === "s3") {
    const { client, bucket, region, PutObjectCommand } =
      getS3ClientAndCommands();
    const key = `videos/${file.filename}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(file.path),
        ContentType: file.mimetype || "video/mp4",
      })
    );

    try {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      console.error("Failed to cleanup temp upload after S3 upload:", err.message);
    }

    const publicBase = (process.env.S3_PUBLIC_URL || "").replace(/\/$/, "");
    if (publicBase) {
      return `${publicBase}/${key}`;
    }

    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
};

exports.deleteVideo = async (videoPath) => {
  if (!videoPath) return;

  const provider = getStorageProvider();

  if (provider === "s3" && /^https?:\/\//i.test(videoPath)) {
    try {
      const { client, bucket, DeleteObjectCommand } = getS3ClientAndCommands();
      const parsedUrl = new URL(videoPath);
      const key = parsedUrl.pathname.replace(/^\/+/, "");
      if (key) {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
      }
    } catch (err) {
      console.error("Failed to delete S3 video object:", err.message);
    }
    return;
  }

  if (!/^https?:\/\//i.test(videoPath)) {
    try {
      const filePath = path.join(
        process.cwd(),
        videoPath.replace(/^\/+/, "")
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Failed to delete local video:", err.message);
    }
  }
};
