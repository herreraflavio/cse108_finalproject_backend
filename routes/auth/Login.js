const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const User = require("../../models/User");

router.post("/", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(400).send("User not found.");

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(401).send("Invalid credentials.");

  req.session.userId = user._id;
  res.send("Logged in successful.");
});

module.exports = router;
