const express = require("express");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    // console.log(req.body.data);
    res.send({ message: "hello world : )" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
