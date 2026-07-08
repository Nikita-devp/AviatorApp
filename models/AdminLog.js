const mongoose = require("mongoose");

const AdminLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  adminUsername: {
    type: String,
    required: true
  },

  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  targetUsername: {
    type: String
  },

  action: {
    type: String,
    required: true
  },

  details: {
    type: String,
    default: ""
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("AdminLog", AdminLogSchema);