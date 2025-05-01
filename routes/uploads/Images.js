/*  Theme-image upload (CommonJS version)  */
const express = require("express");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../../utils/s3Client"); // adjust path
const { v4: uuid } = require("uuid");
const path = require("path");

const router = express.Router();

/* ─── config ──────────────────────────────────────────────────────────── */
const BUCKET = process.env.AWS_S3_BUCKET; // set in .env
const MAX_MB = 25;
const ALLOW = ["image/png", "image/jpeg", "image/webp"];

/* ─── multer (in-memory) ──────────────────────────────────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    ALLOW.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only PNG, JPEG, or WebP images are allowed.")),
});

/**
 * POST /api/themes/images    (field name: files)
 * Accepts up to 10 images; responds with [{ key, url }, …]
 */
router.post("/", upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files received." });

    const uploads = await Promise.all(
      req.files.map(async (file) => {
        console.log("uploading photos to s3");
        const ext = path.extname(file.originalname).toLowerCase(); // ".png"
        const key = `${(req.user && req.user._id) || "anon"}/${uuid()}${ext}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            // ACL: "public-read",  // enable if bucket is private and you prefer ACLs
          })
        );

        return {
          key,
          url: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
        };
      })
    );

    res.json({ uploads });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed." });
  }
});

module.exports = router;
