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

// ✅ USERS + SEARCH
router.get("/users", auth, admin, async (req, res) => {
  try {
    
	const search = (req.query.search || "").trim();
const role = req.query.role || "all";
const banned = req.query.banned || "all";

const filter = {};

if (role !== "all") {
  filter.role = role;
}

if (banned === "true") {
  filter.isBanned = true;
}

if (banned === "false") {
  filter.isBanned = false;
}
	

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } }
      ];

      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        filter.$or.push({ _id: search });
      }
    }

    const users = await User.find(
      filter,
      "username balance role isBanned createdAt"
    )
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(users);

  } catch (err) {
    res.status(500).json({
      error: "Server error"
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

    if (balance === undefined || isNaN(Number(balance)) || Number(balance) < 0) {
      return res.status(400).json({
        error: "Invalid balance"
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

    res.json({ success: true });

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

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({
      error: "Server error"
    });
  }
});

module.exports = router;