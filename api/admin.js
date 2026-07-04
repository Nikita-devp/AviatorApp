const express = require("express");
const router = express.Router();
const User = require("../models/User");

const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

router.get("/", auth, admin, (req, res) => {
  res.json({
    message: "ADMIN PANEL OK",
    username: req.user.username,
    role: req.user.role
  });
});

router.get("/users", auth, admin, async (req, res) => {
  try {

    const users =
      await User.find(
        {},
        "username balance role"
      );

    res.json(users);

  } catch {

    res.status(500).json({
      error:"Server error"
    });

  }
});

router.get("/user/:id", auth, admin, async (req, res) => {
  try {

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    res.json(user);

  } catch (err) {

    res.status(500).json({
      error: "Server error"
    });

  }
});


module.exports = router;