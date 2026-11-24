const mongoose = require("mongoose");

const PlayLogSchema = new mongoose.Schema(
  {
    advertisement_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Advertisement",
    },
    adTitle: {
      type: String,
      trim: true,
      default: "Untitled Ad",
    },
    mediaType: {
      type: String,
      enum: ["video", "image"],
      default: "video",
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    deviceName: {
      type: String,
      default: "",
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
    },
    location_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
      default: Date.now,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlayLog", PlayLogSchema);
