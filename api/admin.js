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

router.patch("/user/:id/balance", auth, admin, async (req, res) => {
  try {

    const { balance } = req.body;

    if (balance === undefined) {
      return res.status(400).json({
        error: "Balance is required"
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    user.balance = Number(balance);

    await user.save();

    res.json({
      success: true,
      balance: user.balance
    });

  } catch (err) {

    res.status(500).json({
      error: "Server error"
    });

  }
});

router.patch("/user/:id/ban", auth, admin, async (req, res) => {
  try {

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    user.isBanned = true;

    await user.save();

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      error: "Server error"
    });

  }
});

router.patch("/user/:id/unban", auth, admin, async (req, res) => {
  try {

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    user.isBanned = false;

    await user.save();

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      error: "Server error"
    });

  }
});


module.exports = router;