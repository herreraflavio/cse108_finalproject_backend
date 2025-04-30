const express = require("express");
const router = express.Router();
const Post = require("../../models/Post");
const User = require("../../models/User");

// Assumes ensureAuth middleware is already applied where this route is mounted
router.get("/", async (req, res) => {
  try {
    const currentUserId = req.session.userId;

    // 1. Get current user's following list
    const currentUser = await User.findById(currentUserId).select("following");
    const userIdsToInclude = [currentUserId, ...currentUser.following];

    // 2. Fetch posts from those users, newest first
    const posts = await Post.find({ user: { $in: userIdsToInclude } })
      .sort({ timestamp: -1 })
      .populate("user", "username profile_picture")
      .populate("comments.user", "username profile_picture")
      .exec();

    // 3. Format posts
    const formattedFeed = posts.map((post) => ({
      id: post._id.toString(),
      timestamp: post.timestamp.toISOString(),
      user: {
        username: post.user.username,
        profile_picture: post.user.profile_picture || "",
      },
      content: post.content,
      likes: post.likes,
      comments: post.comments.map((comment) => ({
        id: comment._id.toString(),
        timestamp: comment.timestamp.toISOString(),
        user: {
          username: comment.user?.username || "Unknown",
          profile_picture: comment.user?.profile_picture || "",
        },
        content: comment.content,
      })),
    }));

    res.json({ feed: formattedFeed });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

module.exports = router;
