const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Failed to log out." });
    }

    res.clearCookie("connect.sid"); // Default session cookie name
    res.json({ message: "Logged out successfully." });
  });
});

module.exports = router;
