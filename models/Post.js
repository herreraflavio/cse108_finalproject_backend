const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  imageUrls: { type: [String], default: [] }, // ← added
  timestamp: { type: Date, default: Date.now },
});

const PostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  imageUrls: { type: [String], default: [] }, // ← added
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [CommentSchema],
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Post", PostSchema, "posts");
