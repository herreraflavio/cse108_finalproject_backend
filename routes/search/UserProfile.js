const express = require("express");
const router = express.Router();
const User = require("../../models/User");

// GET /search/userprofile?q=<username>&page=&limit=
router.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const regex = new RegExp(q, "i");

    const users = await User.find({ username: regex })
      .select("username profile_picture followers following")
      .skip(skip)
      .limit(limit)
      .populate("followers", "username profile_picture")
      .populate("following", "username profile_picture");

    res.json({ users, pagination: { page, limit } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /search/userprofile/self?followersPage=&followingPage=&limit=
router.get("/self", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const followersPage = parseInt(req.query.followersPage) || 1;
    const followingPage = parseInt(req.query.followingPage) || 1;
    const limit = parseInt(req.query.limit) || 5;

    const skipFollowers = (followersPage - 1) * limit;
    const skipFollowing = (followingPage - 1) * limit;

    const user = await User.findById(userId)
      .select("username profile_picture")
      .populate({
        path: "followers",
        select: "username profile_picture",
        options: { skip: skipFollowers, limit },
      })
      .populate({
        path: "following",
        select: "username profile_picture",
        options: { skip: skipFollowing, limit },
      });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      user,
      pagination: {
        followersPage,
        followingPage,
        limit,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
