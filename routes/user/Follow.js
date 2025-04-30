const express = require("express");
const router = express.Router();
const User = require("../../models/User");

// This route assumes ensureAuth middleware is used before this router
router.post("/", async (req, res) => {
  const targetUserId = req.body.userId;
  const currentUserId = req.session.userId;

  if (currentUserId === targetUserId) {
    return res.status(400).json({ error: "You cannot follow yourself." });
  }

  try {
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ error: "User to follow not found." });
    }

    // Check if already following
    const alreadyFollowing = currentUser.following.includes(targetUserId);
    if (alreadyFollowing) {
      return res
        .status(400)
        .json({ error: "You are already following this user." });
    }

    // Add target to current user's following
    currentUser.following.push(targetUserId);
    await currentUser.save();

    // Add current user to target's followers
    targetUser.followers.push(currentUserId);
    await targetUser.save();

    res.json({ message: `Successfully followed ${targetUser.username}` });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
