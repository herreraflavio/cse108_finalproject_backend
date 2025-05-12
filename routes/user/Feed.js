const express = require("express");
const router = express.Router();
const Post = require("../../models/Post");
const User = require("../../models/User");

// Assumes ensureAuth middleware is already applied
router.get("/", async (req, res) => {
  try {
    const currentUserId = req.session.userId;

    // 1. Get current user's following list
    const currentUser = await User.findById(currentUserId).select("following");

    // 2. Include both followed users AND self
    const userIdsToInclude = [...currentUser.following, currentUserId];
    console.log("Feed will include posts from:", userIdsToInclude);

    // 3. Fetch posts from all included users (including self)
    const posts = await Post.find({
      user: { $in: userIdsToInclude },
    })
      .sort({ timestamp: -1 })
      .populate("user", "username profile_picture")
      .populate("comments.user", "username profile_picture")
      .exec();

    // 4. Format posts
    const formattedFeed = posts.map((post) => ({
      id: post._id.toString(),
      timestamp: post.timestamp.toISOString(),
      user: {
        username: post.user.username,
        profile_picture: post.user.profile_picture || "",
      },
      content: post.content,
      imageUrls: post.imageUrls || [], // ← include post images
      likes: post.likes,
      comments: post.comments.map((comment) => ({
        id: comment._id.toString(),
        timestamp: comment.timestamp.toISOString(),
        user: {
          username: comment.user?.username || "Unknown",
          profile_picture: comment.user?.profile_picture || "",
        },
        content: comment.content,
        imageUrls: comment.imageUrls || [], // ← include comment images
      })),
    }));

    res.json({ feed: formattedFeed });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

module.exports = router;
