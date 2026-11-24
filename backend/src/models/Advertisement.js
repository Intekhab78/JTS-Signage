const mongoose = require("mongoose");

const advertisementSchema = new mongoose.Schema(
  {
    company_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true,
      },
    ],

    location_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
        required: true,
      },
    ],

    /* 🔥 Custom Device ID (NOT MAC) */
    deviceId: [
      {
        type: String,
      },
    ],

    title: {
      type: String,
      trim: true,
    },

    description: String,

    /* 🔥 Order in playlist */
    playOrder: {
      type: Number,
      default: 1,
    },

    videoPath: {
      type: String,
      required: true,
    },

    mediaType: {
      type: String,
      enum: ["video", "image"],
      default: "video",
    },

    displayDuration: {
      type: Number,
      default: 10,
    },

    tickerText: {
      type: String,
      trim: true,
      default: "",
    },

    priority: {
      type: Number,
      default: 1,
    },

    isFallback: {
      type: Boolean,
      default: false,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    startTime: {
      type: String,
      trim: true,
    },

    endTime: {
      type: String,
      trim: true,
    },

    days: [
      {
        type: String,
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Advertisement", advertisementSchema);