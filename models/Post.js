// const mongoose = require("mongoose");

// const PostSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   content: { type: String, required: true },
//   likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Changed from Number to an array of user references
//   comments: [
//     {
//       user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//       content: { type: String, required: true },
//       timestamp: { type: Date, default: Date.now },
//     },
//   ],
//   timestamp: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Post", PostSchema, "posts");
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
