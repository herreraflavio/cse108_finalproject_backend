// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcrypt");

// const User = require("../../models/User");

// router.post("/", async (req, res) => {
//   const { username, password } = req.body;

//   const user = await User.findOne({ username });
//   if (!user) return res.status(400).send("User not found.");

//   const validPassword = await bcrypt.compare(password, user.password);
//   if (!validPassword) return res.status(401).send("Invalid credentials.");

//   req.session.userId = user._id;
//   res.send("Logged in successful.");
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../../models/User");

router.post("/", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "User not found." });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials." });

  // 1) Create the session for your HTTP routes:
  req.session.userId = user._id;

  // 2) Issue a short‐lived JWT just for Socket.IO:
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });

  // 3) Return both session cookie *and* the token
  res.json({ message: "Logged in successfully.", token });
});

module.exports = router;
