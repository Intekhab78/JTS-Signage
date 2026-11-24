const Advertisement = require("../models/Advertisement");
const Device = require("../models/Device");
const activeScreens = require("../activeScreens");
const socketInstance = require("../socketInstance");

const scheduledByDevice = new Map();
const manualStoppedSignatureByDevice = new Map();
let schedulerTimer = null;
let tickInFlight = false;

const getStartOfDay = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
};

const getEndOfDay = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    23,
    59,
    59,
    999
  );
};

const toMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const isAdScheduledNow = (ad, now, currentDay, currentMinutes) => {
  if (ad.isFallback) return false;

  const hasSchedule = Boolean(
    ad.startDate ||
      ad.endDate ||
      ad.startTime ||
      ad.endTime ||
      (ad.days && ad.days.length > 0)
  );
  if (!hasSchedule) return false;

  if (ad.startDate && now < getStartOfDay(ad.startDate)) {
    return false;
  }
  if (ad.endDate && now > getEndOfDay(ad.endDate)) {
    return false;
  }

  if (ad.days && ad.days.length > 0 && !ad.days.includes(currentDay)) {
    return false;
  }

  const startMin = toMinutes(ad.startTime);
  const endMin = toMinutes(ad.endTime);

  if (startMin !== null && endMin !== null) {
    if (startMin <= endMin) {
      if (currentMinutes < startMin || currentMinutes > endMin) return false;
    } else {
      // Overnight schedule (e.g. 22:00 to 06:00)
      if (currentMinutes < startMin && currentMinutes > endMin) return false;
    }
  } else if (startMin !== null) {
    if (currentMinutes < startMin) return false;
  } else if (endMin !== null) {
    if (currentMinutes > endMin) return false;
  }

  return true;
};

const sortByPriorityAndOrder = (a, b) => {
  const prioDiff = (b.priority || 1) - (a.priority || 1);
  if (prioDiff !== 0) return prioDiff;
  return (a.playOrder || 1) - (b.playOrder || 1);
};

const buildScheduleSignature = (deviceAds) =>
  deviceAds
    .map(
      (a) =>
        `${a._id}@${a.startTime || ""}-${a.endTime || ""}:${
          a.startDate ? new Date(a.startDate).toISOString().slice(0, 10) : ""
        }:${a.endDate ? new Date(a.endDate).toISOString().slice(0, 10) : ""}`
    )
    .join(",");

const runSchedulerTick = async () => {
  if (tickInFlight) return;
  tickInFlight = true;

  try {
    const now = new Date();
    const batchEpoch = now.getTime();
    const currentDay = now.toLocaleString("en-US", { weekday: "long" });
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const ads = await Advertisement.find({ isActive: true }).sort({
      priority: -1,
      playOrder: 1,
    });

    let io = null;
    try {
      io = socketInstance.getIO();
    } catch {
      return;
    }

    const deviceAdsMap = new Map();

    const addAdToDevice = (deviceId, ad) => {
      if (!deviceId) return;
      if (!deviceAdsMap.has(deviceId)) {
        deviceAdsMap.set(deviceId, new Map());
      }
      deviceAdsMap.get(deviceId).set(String(ad._id), ad);
    };

    for (const ad of ads) {
      if (!isAdScheduledNow(ad, now, currentDay, currentMinutes)) {
        continue;
      }

      if (Array.isArray(ad.deviceId) && ad.deviceId.length > 0) {
        ad.deviceId.forEach((deviceId) => addAdToDevice(deviceId, ad));
      } else {
        const matchingDevices = await Device.find({
          company_id: { $in: ad.company_ids || [] },
          location_id: { $in: ad.location_ids || [] },
          status: "active",
        });
        matchingDevices.forEach((d) => addAdToDevice(d.deviceId, ad));
      }
    }

    // 1️⃣ Emit scheduled ads
    let anyBroadcastNeeded = false;
    for (const [deviceId, adMap] of deviceAdsMap.entries()) {
      const deviceAds = Array.from(adMap.values()).sort(sortByPriorityAndOrder);
      const signature = buildScheduleSignature(deviceAds);
      const screen = activeScreens.get(deviceId);
      if (!screen) continue;

      const isNewScheduleWindow = scheduledByDevice.get(deviceId) !== signature;
      if (isNewScheduleWindow) {
        manualStoppedSignatureByDevice.delete(deviceId);
      }

      if (manualStoppedSignatureByDevice.get(deviceId) === signature) {
        continue;
      }

      if (
        isNewScheduleWindow ||
        (!screen.currentVideo && screen.currentVideo !== "PAUSED")
      ) {
        const clock = activeScreens.startPlaybackClock(deviceId, {
          ads: deviceAds,
          companyId: screen.companyId || null,
          locationId: screen.locationId || null,
          startedBy: "scheduler",
          anchorEpochMs: batchEpoch,
          inheritLocationPeer: true,
        });
        Device.updateOne(
          { deviceId },
          {
            $set: {
              playbackStatus: "playing",
              currentPlaylist: deviceAds.map((a) => a._id),
              currentVideo:
                clock.currentVideo || deviceAds[0]?.videoPath || null,
              currentTime: clock.currentTime || 0,
              playbackStartedBy: "scheduler",
            },
          }
        ).catch((err) =>
          console.error("Scheduler persist play error:", err.message)
        );
        scheduledByDevice.set(deviceId, signature);
        io.to(`device_${deviceId}`).emit("play_ads", {
          deviceId,
          ads: deviceAds,
          resumeTime: clock.currentTime,
          startIndex: clock.adIndex,
          serverNow: Date.now(),
        });
        anyBroadcastNeeded = true;
      }
    }

    // 2️⃣ Fallback default playlist or schedule expiry cleanup for online screens
    const onlineScreens = activeScreens.list();
    for (const screen of onlineScreens) {
      const deviceId = screen.deviceId;
      if (deviceAdsMap.has(deviceId)) continue;

      manualStoppedSignatureByDevice.delete(deviceId);
      const prevSig = scheduledByDevice.get(deviceId);
      const hadActiveSchedule =
        Boolean(prevSig) && !String(prevSig).startsWith("fallback:");

      if (hadActiveSchedule) {
        scheduledByDevice.delete(deviceId);
      }

      if (screen.currentVideo === "PAUSED") continue;

      const saved = activeScreens.getPlaybackState(deviceId);
      if (saved?.startedBy === "manual") continue;

      const deviceDoc = await Device.findOne({ deviceId });
      if (!deviceDoc || deviceDoc.status !== "active") continue;

      const fallbackAds = await Advertisement.find({
        isActive: true,
        isFallback: true,
        company_ids: deviceDoc.company_id,
        location_ids: { $in: deviceDoc.location_id || [] },
        $or: [{ deviceId: { $in: [deviceId] } }, { deviceId: { $size: 0 } }],
      }).sort({ priority: -1, playOrder: 1 });

      if (fallbackAds.length > 0) {
        const fallbackSig =
          "fallback:" + fallbackAds.map((a) => String(a._id)).join(",");
        if (
          scheduledByDevice.get(deviceId) !== fallbackSig ||
          !screen.currentVideo
        ) {
          const clock = activeScreens.startPlaybackClock(deviceId, {
            ads: fallbackAds,
            companyId: deviceDoc.company_id || screen.companyId || null,
            locationId:
              screen.locationId || deviceDoc.location_id?.[0] || null,
            startedBy: "scheduler",
            anchorEpochMs: batchEpoch,
            inheritLocationPeer: true,
          });
          Device.updateOne(
            { deviceId },
            {
              $set: {
                playbackStatus: "playing",
                currentPlaylist: fallbackAds.map((a) => a._id),
                currentVideo:
                  clock.currentVideo || fallbackAds[0]?.videoPath || null,
                currentTime: clock.currentTime || 0,
                playbackStartedBy: "scheduler",
              },
            }
          ).catch((err) =>
            console.error("Scheduler fallback persist error:", err.message)
          );
          scheduledByDevice.set(deviceId, fallbackSig);
          io.to(`device_${deviceId}`).emit("play_ads", {
            deviceId,
            ads: fallbackAds,
            resumeTime: clock.currentTime,
            startIndex: clock.adIndex,
            serverNow: Date.now(),
          });
          anyBroadcastNeeded = true;
        }
      } else if (hadActiveSchedule || scheduledByDevice.has(deviceId)) {
        scheduledByDevice.delete(deviceId);
        if (saved?.startedBy === "scheduler") {
          activeScreens.setPlaybackState(deviceId, {
            status: "stopped",
            ads: [],
            adIndex: 0,
            currentVideo: null,
            pausedVideoPath: null,
            currentTime: 0,
            anchorTime: 0,
            anchorEpochMs: null,
            startedBy: null,
          });
          Device.updateOne(
            { deviceId },
            {
              $set: {
                playbackStatus: "stopped",
                currentPlaylist: [],
                currentVideo: null,
                currentTime: 0,
                playbackStartedBy: null,
              },
            }
          ).catch((err) =>
            console.error("Scheduler persist stop error:", err.message)
          );
          activeScreens.updateVideo(deviceId, null);
          io.to(`device_${deviceId}`).emit("stop_ads", { deviceId });
          anyBroadcastNeeded = true;
        }
      }
    }

    if (anyBroadcastNeeded) {
      activeScreens.broadcastLiveScreens(io);
    }

    // 3️⃣ Clean up any previously scheduled offline devices no longer in window
    for (const deviceId of Array.from(scheduledByDevice.keys())) {
      if (!deviceAdsMap.has(deviceId) && !activeScreens.get(deviceId)) {
        scheduledByDevice.delete(deviceId);
        manualStoppedSignatureByDevice.delete(deviceId);
        const saved = activeScreens.getPlaybackState(deviceId);
        if (saved?.startedBy === "scheduler") {
          activeScreens.setPlaybackState(deviceId, {
            status: "stopped",
            ads: [],
            adIndex: 0,
            currentVideo: null,
            pausedVideoPath: null,
            currentTime: 0,
            anchorTime: 0,
            anchorEpochMs: null,
            startedBy: null,
          });
          Device.updateOne(
            { deviceId },
            {
              $set: {
                playbackStatus: "stopped",
                currentPlaylist: [],
                currentVideo: null,
                currentTime: 0,
                playbackStartedBy: null,
              },
            }
          ).catch((err) =>
            console.error("Scheduler persist stop error:", err.message)
          );
        }
      }
    }
  } catch (err) {
    console.error("Scheduler error:", err);
  } finally {
    tickInFlight = false;
  }
};

const startAdScheduler = () => {
  console.log("Ad Scheduler started (5s precision)...");
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }
  runSchedulerTick();
  schedulerTimer = setInterval(runSchedulerTick, 5000);
};

startAdScheduler.trigger = () => {
  runSchedulerTick();
};

startAdScheduler.resetScheduleCache = (deviceId = null) => {
  if (deviceId) {
    scheduledByDevice.delete(deviceId);
    manualStoppedSignatureByDevice.delete(deviceId);
  } else {
    scheduledByDevice.clear();
    manualStoppedSignatureByDevice.clear();
  }
};

startAdScheduler.markManualStop = (deviceId) => {
  if (!deviceId) return;
  const activeSig = scheduledByDevice.get(deviceId);
  if (activeSig) {
    manualStoppedSignatureByDevice.set(deviceId, activeSig);
  }
};

startAdScheduler.isAdScheduledAt = (ad, date = new Date()) => {
  const day = date.toLocaleString("en-US", { weekday: "long" });
  const mins = date.getHours() * 60 + date.getMinutes();
  return isAdScheduledNow(ad, date, day, mins);
};

module.exports = startAdScheduler;
