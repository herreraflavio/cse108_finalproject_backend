const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Post = require("../../models/Post");

// Create a new post
router.post("/", async (req, res) => {
  try {
    const { content, imageUrls = [] } = req.body;
    console.log(imageUrls);
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const newPost = new Post({
      user: userId,
      content,
      imageUrls, // ← store the image URLs
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

// Route to like/unlike a post
router.post("/like/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body; // Assume userId is passed in request body (from session or token)

    // Find the post
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the user already liked the post
    if (post.likes.includes(userId)) {
      // Unlike the post
      post.likes = post.likes.filter((like) => like.toString() !== userId);
    } else {
      // Like the post
      post.likes.push(userId);
    }

    await post.save();
    res.status(200).json({ message: "Post updated", post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to like/unlike post", error: err });
  }
});

// Add a comment (with optional images)
router.post("/comment/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, imageUrls = [] } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const newComment = {
      user: new mongoose.Types.ObjectId(userId), // ← use `new`
      content,
      imageUrls,
      timestamp: new Date(),
    };

    post.comments.push(newComment);
    await post.save();

    res.status(200).json({
      message: "Comment added",
      comment: post.comments[post.comments.length - 1],
    });
  } catch (err) {
    console.error("Error adding comment:", err);
    res
      .status(500)
      .json({ message: "Failed to add comment", error: err.message });
  }
});

module.exports = router;
