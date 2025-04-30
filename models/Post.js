const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  likes: { type: Number, default: 0 },
  comments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      content: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Post", PostSchema, "posts");
