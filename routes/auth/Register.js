// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcrypt");

// const User = require("../../models/User");

// router.post("/", async (req, res) => {
//   const { username, role, password } = req.body;
//   const hashedPassword = await bcrypt.hash(password, 10);

//   try {
//     const user = new User({ username, role, password: hashedPassword });
//     await user.save();
//     res.send("User registered.");
//   } catch (err) {
//     res.status(400).send("Error creating user.");
//   }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const User = require("../../models/User");

router.post("/", async (req, res) => {
  const { username, role, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = new User({
      username,
      role,
      password: hashedPassword,
      profile_picture: "", // No profile picture initially
      followers: [], // No followers initially
      following: [], // Not following anyone initially
    });

    await user.save();
    res.send("User registered.");
  } catch (err) {
    console.error(err);
    res.status(400).send("Error creating user.");
  }
});

module.exports = router;
