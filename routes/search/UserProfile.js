const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../../models/User");

router.get("/", async (req, res) => {
  try {
    // 1) grab the query string
    const q = (req.query.q || "").trim();
    console.log("search term:", q);

    // 2) build your case‐insensitive regex
    const regex = new RegExp(q, "i");

    // 3) find users whose username matches
    const users = await User.find({ username: regex }).select(
      "username profilePicture"
    ); // include whatever fields you need

    console.log("search result:", users);

    // 4) send them back
    return res.json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
module.exports = router;
