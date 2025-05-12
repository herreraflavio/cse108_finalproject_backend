// /*  Theme-image upload (CommonJS version)  */
// const express = require("express");
// const multer = require("multer");
// const { PutObjectCommand } = require("@aws-sdk/client-s3");
// const { s3 } = require("../../utils/s3Client"); // adjust path
// const { v4: uuid } = require("uuid");
// const path = require("path");

// const router = express.Router();

// /* ─── config ──────────────────────────────────────────────────────────── */
// const BUCKET = process.env.AWS_S3_BUCKET; // set in .env
// const MAX_MB = 25;
// const ALLOW = ["image/png", "image/jpeg", "image/webp"];

// /* ─── multer (in-memory) ──────────────────────────────────────────────── */
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: MAX_MB * 1024 * 1024 },
//   fileFilter: (_, file, cb) =>
//     ALLOW.includes(file.mimetype)
//       ? cb(null, true)
//       : cb(new Error("Only PNG, JPEG, or WebP images are allowed.")),
// });

// /**
//  * POST /api/themes/images    (field name: files)
//  * Accepts up to 10 images; responds with [{ key, url }, …]
//  */
// router.post("/", upload.array("files", 10), async (req, res) => {
//   try {
//     if (!req.files || req.files.length === 0)
//       return res.status(400).json({ error: "No files received." });

//     const uploads = await Promise.all(
//       req.files.map(async (file) => {
//         console.log("uploading photos to s3");
//         const ext = path.extname(file.originalname).toLowerCase(); // ".png"
//         const key = `${(req.user && req.user._id) || "anon"}/${uuid()}${ext}`;

//         await s3.send(
//           new PutObjectCommand({
//             Bucket: BUCKET,
//             Key: key,
//             Body: file.buffer,
//             ContentType: file.mimetype,
//             // ACL: "public-read",  // enable if bucket is private and you prefer ACLs
//           })
//         );

//         return {
//           key,
//           url: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
//         };
//       })
//     );

//     res.json({ uploads });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Upload failed." });
//   }
// });

// module.exports = router;
// routes/uploads/Images.js
// At the VERY top of the file or in your server entrypoint (index.js)

require("dotenv").config();

const express = require("express");
const multer = require("multer");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3 } = require("../../utils/s3Client");
const { v4: uuid } = require("uuid");
const path = require("path");

const router = express.Router();

/* ─── Debugging .env ────────────────────────────────────────────── */
const BUCKET = process.env.AWS_S3_BUCKET_DEV;
const REGION = process.env.AWS_REGION;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID_DEV;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY_DEV;

console.log(BUCKET, REGION, ACCESS_KEY, SECRET_KEY);

console.log("ENVIRONMENT DEBUG:");
console.log("  AWS_S3_BUCKET       =", BUCKET);
console.log("  AWS_REGION          =", REGION);
console.log("  AWS_ACCESS_KEY_ID   =", ACCESS_KEY ? "[OK]" : "[MISSING]");
console.log("  AWS_SECRET_ACCESS_KEY =", SECRET_KEY ? "[OK]" : "[MISSING]");
console.log("────────────────────────────────────────────");

/* ─── Sanity check ─────────────────────────────────────────────── */
if (!BUCKET || typeof BUCKET !== "string") {
  throw new Error("Missing or invalid AWS_S3_BUCKET in .env");
}
if (!REGION || typeof REGION !== "string") {
  throw new Error("Missing or invalid AWS_REGION in .env");
}
if (!ACCESS_KEY || !SECRET_KEY) {
  throw new Error("Missing AWS credentials in .env");
}

/* ─── multer config ─────────────────────────────────────────────── */
const MAX_MB = 25;
const ALLOW = ["image/png", "image/jpeg", "image/webp"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    ALLOW.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only PNG, JPEG or WebP allowed")),
});

/* ─── GET a signed URL for image ────────────────────────────────── */
router.get("/*key", async (req, res) => {
  try {
    console.log("attmepting to get key");
    const key = Array.isArray(req.params.key)
      ? req.params.key.join("/")
      : req.params.key;

    console.log("[GET SIGNED URL] Key:", key);

    if (
      !key ||
      typeof key !== "string" ||
      key.includes("..") ||
      key.length > 512
    ) {
      return res.status(400).json({ error: "Invalid key." });
    }

    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });

    console.log("[SIGNED URL GENERATED]", signedUrl);
    res.json({ signedUrl });
  } catch (err) {
    console.error("Signed-URL error:", err);
    res.status(500).json({ error: "Could not generate signed URL." });
  }
});

/* ─── POST image uploads ────────────────────────────────────────── */
router.post("/", upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: "No files received." });
    }

    const uploads = await Promise.all(
      req.files.map(async (file) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const key = `${req.user?.id || "anon"}/${uuid()}${ext}`;

        console.log("[UPLOAD]", key, file.mimetype, file.size, "bytes");

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          })
        );

        return { key };
      })
    );

    res.json({ uploads });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: "Upload failed." });
  }
});

module.exports = router;

// require("dotenv").config();

// const express = require("express");
// const multer = require("multer");
// const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
// const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
// const { s3 } = require("../../utils/s3Client");
// const { v4: uuid } = require("uuid");
// const path = require("path");

// const router = express.Router();

// const UploadCounter = require("../../models/UploadCounter");
// const MAX_UPLOADS = 1000;

// /* ─── Debugging .env ────────────────────────────────────────────── */
// const BUCKET = process.env.AWS_S3_BUCKET;
// const REGION = process.env.AWS_REGION;
// const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
// const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// console.log("ENVIRONMENT DEBUG:");
// console.log("  AWS_S3_BUCKET       =", BUCKET);
// console.log("  AWS_REGION          =", REGION);
// console.log("  AWS_ACCESS_KEY_ID   =", ACCESS_KEY ? "[OK]" : "[MISSING]");
// console.log("  AWS_SECRET_ACCESS_KEY =", SECRET_KEY ? "[OK]" : "[MISSING]");
// console.log("────────────────────────────────────────────");

// /* ─── Sanity check ─────────────────────────────────────────────── */
// if (!BUCKET || typeof BUCKET !== "string") {
//   throw new Error("Missing or invalid AWS_S3_BUCKET in .env");
// }
// if (!REGION || typeof REGION !== "string") {
//   throw new Error("Missing or invalid AWS_REGION in .env");
// }
// if (!ACCESS_KEY || !SECRET_KEY) {
//   throw new Error("Missing AWS credentials in .env");
// }

// /* ─── multer config ─────────────────────────────────────────────── */
// const MAX_MB = 11;
// const ALLOW = ["image/png", "image/jpeg", "image/webp"];
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: MAX_MB * 1024 * 1024 },
//   fileFilter: (_, file, cb) =>
//     ALLOW.includes(file.mimetype)
//       ? cb(null, true)
//       : cb(new Error("Only PNG, JPEG or WebP allowed")),
// });

// /* ─── GET a signed URL for image ────────────────────────────────── */
// router.get("/*key", async (req, res) => {
//   try {
//     const key = Array.isArray(req.params.key)
//       ? req.params.key.join("/")
//       : req.params.key;

//     console.log("[GET SIGNED URL] Key:", key);

//     if (
//       !key ||
//       typeof key !== "string" ||
//       key.includes("..") ||
//       key.length > 512
//     ) {
//       return res.status(400).json({ error: "Invalid key." });
//     }

//     const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
//     const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });

//     console.log("[SIGNED URL GENERATED]", signedUrl);
//     res.json({ signedUrl });
//   } catch (err) {
//     console.error("Signed-URL error:", err);
//     res.status(500).json({ error: "Could not generate signed URL." });
//   }
// });

// /* ─── POST image uploads ────────────────────────────────────────── */
// router.post("/", upload.array("files", 10), async (req, res) => {
//   try {
//     if (!req.files?.length) {
//       return res.status(400).json({ error: "No files received." });
//     }

//     const incomingCount = req.files?.length || 0;

//     // 1. Get current count
//     const counterDoc = await UploadCounter.findOne({ name: "global" });

//     if (!counterDoc) {
//       return res.status(500).json({ error: "Upload counter not initialized." });
//     }

//     const newTotal = counterDoc.count + incomingCount;

//     // 2. Reject if exceeds limit
//     if (newTotal > MAX_UPLOADS) {
//       return res.status(403).json({
//         error: "Upload limit reached.",
//         remaining: MAX_UPLOADS - counterDoc.count,
//       });
//     }

//     const uploads = await Promise.all(
//       req.files.map(async (file) => {
//         const ext = path.extname(file.originalname).toLowerCase();
//         const key = `${req.user?.id || "anon"}/${uuid()}${ext}`;

//         console.log("[UPLOAD]", key, file.mimetype, file.size, "bytes");

//         await s3.send(
//           new PutObjectCommand({
//             Bucket: BUCKET,
//             Key: key,
//             Body: file.buffer,
//             ContentType: file.mimetype,
//           })
//         );

//         return { key };
//       })
//     );

//     // 4. Atomically increment counter
//     await UploadCounter.updateOne(
//       { name: "global" },
//       { $inc: { count: incomingCount } }
//     );

//     console.log(newTotal);

//     console.log(uploads);
//     res.json({ uploads });
//   } catch (err) {
//     console.error("Upload error:", err.message);
//     res.status(500).json({ error: "Upload failed." });
//   }
// });

// module.exports = router;
