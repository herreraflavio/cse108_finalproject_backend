// models/UploadCounter.js
const mongoose = require("mongoose");

const uploadCounterSchema = new mongoose.Schema({
  name: { type: String, default: "global", unique: true },
  count: { type: Number, default: 0 },
});

module.exports = mongoose.model("UploadCounter", uploadCounterSchema);
