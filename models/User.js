const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
  username: {
    type: String,
    unique: true
  },

  password: String,

  balance: {
    type: Number,
    default: 1000
  },

  bet: {
    type: Number,
    default: 0
  },

  nextBet: {
    type: Number,
    default: 0
  },

  cashedOut: {
    type: Boolean,
    default: false
  },

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },

  isBanned: {
    type: Boolean,
    default: false
  }

},
{
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);