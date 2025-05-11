// const express = require("express");
// const multer = require("multer");
// const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
// const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
// const { s3 } = require("../../utils/s3Client"); // adjust path if needed
// const { v4: uuid } = require("uuid");
// const path = require("path");

// const router = express.Router();

// /* ─── Config ─────────────────────────────────────────────────────────── */
// const BUCKET = process.env.AWS_S3_BUCKET;
// const MAX_MB = 25;
// const ALLOW = ["image/png", "image/jpeg", "image/webp"];
// const CF_WORKER_SECRET = process.env.CF_WORKER_SECRET || "super-secret";

// /* ─── Multer (In-Memory Storage) ─────────────────────────────────────── */
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: MAX_MB * 1024 * 1024 },
//   fileFilter: (_, file, cb) =>
//     ALLOW.includes(file.mimetype)
//       ? cb(null, true)
//       : cb(new Error("Only PNG, JPEG, or WebP images are allowed.")),
// });

// /**
//  * POST /api/themes/images
//  * Uploads up to 10 images to private S3; responds with keys and Worker URLs.
//  */
// router.post("/", upload.array("files", 10), async (req, res) => {
//   try {
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No files received." });
//     }

//     const uploads = await Promise.all(
//       req.files.map(async (file) => {
//         const ext = path.extname(file.originalname).toLowerCase(); // ".png"
//         const key = `${req.user?.id || "anon"}/${uuid()}${ext}`;

//         await s3.send(
//           new PutObjectCommand({
//             Bucket: BUCKET,
//             Key: key,
//             Body: file.buffer,
//             ContentType: file.mimetype,
//           })
//         );

//         return {
//           key,
//           workerUrl: `https://img.flavioherrera.com/${key}`,
//         };
//       })
//     );

//     res.json({ uploads });
//   } catch (err) {
//     console.error("Upload failed:", err);
//     res.status(500).json({ error: "Upload failed." });
//   }
// });

// /**
//  * GET /api/themes/images/:key
//  * Returns a short-lived signed S3 URL (used by Cloudflare Worker).
//  */
// router.get("/:key(*)", async (req, res) => {
//   try {
//     const key = req.params.key;

//     // 🔐 Basic path safety check
//     if (!key || key.includes("..") || key.length > 512) {
//       return res.status(400).json({ error: "Invalid key." });
//     }

//     // 🔐 Optional: Require shared secret header (from Cloudflare Worker)
//     const incomingSecret = req.headers["x-worker-auth"];
//     if (incomingSecret !== CF_WORKER_SECRET) {
//       return res.status(403).json({ error: "Unauthorized request." });
//     }

//     const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
//     const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

//     res.json({ signedUrl });
//   } catch (err) {
//     console.error("Failed to generate signed URL:", err);
//     res.status(500).json({ error: "Could not generate signed URL." });
//   }
// });

// module.exports = router;

/*  Theme-image upload (CommonJS version)  */
const express = require("express");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../../utils/s3Client"); // adjust path
const { v4: uuid } = require("uuid");
const path = require("path");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");

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
 * GET /api/themes/images/:key
 * Returns a short-lived signed URL to a private S3 object.
 */
router.get("/:key(*)", async (req, res) => {
  try {
    const key = req.params.key;
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 seconds

    res.json({ signedUrl });
  } catch (err) {
    console.error("Failed to generate signed URL:", err);
    res.status(500).json({ error: "Could not generate signed URL." });
  }
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
          workerUrl: `https://img.flavioherrera.com/${key}`, // this is your public-facing URL behind the Worker
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
