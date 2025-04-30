const express = require("express");
const router = express.Router();
const User = require("../../models/User");

// This route assumes ensureAuth middleware is used before this router
router.post("/", async (req, res) => {
  const targetUserId = req.body.userId;
  const currentUserId = req.session.userId;

  if (currentUserId === targetUserId) {
    return res.status(400).json({ error: "You cannot unfollow yourself." });
  }

  try {
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ error: "User to unfollow not found." });
    }

    // Check if not following
    const isFollowing = currentUser.following.includes(targetUserId);
    if (!isFollowing) {
      return res
        .status(400)
        .json({ error: "You are not following this user." });
    }

    // Remove target from current user's following
    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== targetUserId
    );
    await currentUser.save();

    // Remove current user from target user's followers
    targetUser.followers = targetUser.followers.filter(
      (id) => id.toString() !== currentUserId
    );
    await targetUser.save();

    res.json({ message: `Successfully unfollowed ${targetUser.username}` });
  } catch (err) {
    console.error("Unfollow error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
