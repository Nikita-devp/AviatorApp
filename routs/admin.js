const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

router.get("/", auth, admin, (req, res) => {
  res.json({
    message: "ADMIN PANEL OK",
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

module.exports = router;