// utils/s3Client.js  (CommonJS)
const { S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config(); // make sure .env is loaded *once*

const s3 = new S3Client({
  region: process.env.AWS_REGION, // e.g. "us-west-2"
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_DEV,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_DEV,
  },
});

module.exports = { s3 };
