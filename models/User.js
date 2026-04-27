const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: { type: Number, default: 1000 },
  bet: { type: Number, default: 0 },
  nextBet: { type: Number, default: 0 },
  cashedOut: { type: Boolean, default: false }
});

module.exports = mongoose.model("User", userSchema);