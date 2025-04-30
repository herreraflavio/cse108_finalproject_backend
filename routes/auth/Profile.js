const express = require("express");
const router = express.Router();

const User = require("../../models/User");

router.get("/", async (req, res) => {
  if (!req.session.userId) return res.status(401).send("Not authenticated.");

  const user = await User.findById(req.session.userId).select("-password");
  res.json(user);
});

module.exports = router;
