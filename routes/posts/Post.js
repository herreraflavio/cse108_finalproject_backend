const express = require("express");
const router = express.Router();
const Post = require("../../models/Post");

router.post("/", async (req, res) => {
  try {
    const { content } = req.body;

    // Ensure user is logged in
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Create and save new post
    const newPost = new Post({
      user: userId,
      content: content,
    });

    await newPost.save();

    res.status(201).json({
      message: "Post was successful",
      postId: newPost._id,
    });
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
