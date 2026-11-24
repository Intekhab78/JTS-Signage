const mongoose = require("mongoose");

const PairingSessionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    socketId: {
      type: String,
      default: null,
    },
    pairedDeviceId: {
      type: String,
      default: null,
    },
    screenToken: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "paired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PairingSession", PairingSessionSchema);
