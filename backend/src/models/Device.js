const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    deviceName: {
      type: String,
      required: true,
      trim: true,
    },

    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    // ✅ MULTI LOCATION
    location_id: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
        required: true,
      },
    ],

    // 🔥 SHORT TOKEN FOR SCREEN URL
    screenToken: {
      type: String,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // 🔄 Persisted playback state & health
    playbackStatus: {
      type: String,
      enum: ["idle", "playing", "paused", "stopped"],
      default: "idle",
    },

    currentPlaylist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Advertisement",
      },
    ],

    currentVideo: {
      type: String,
      default: null,
    },

    currentTime: {
      type: Number,
      default: 0,
    },

    playbackStartedBy: {
      type: String,
      enum: ["manual", "scheduler", null],
      default: null,
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: null,
    },

    // ⚙️ Screen display & audio settings
    settings: {
      volume: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
      },
      muted: {
        type: Boolean,
        default: false,
      },
      orientation: {
        type: String,
        enum: ["0", "90", "180", "270"],
        default: "0",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", DeviceSchema);
