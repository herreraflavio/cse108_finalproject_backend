const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../../models/User");

router.get("/", async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.session.userId);

    const recommendations = await User.aggregate([
      { $match: { _id: { $ne: currentUserId } } },
      { $sample: { size: 5 } },
      { $project: { password: 0 } },
    ]);

    res.json({ users: recommendations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
module.exports = router;
