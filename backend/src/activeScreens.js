const activeScreens = new Map();
const devicePlaybackState = new Map();
const emergencyOverrides = new Map();
const companyMonitorRooms = new Set();

const computeClockTime = (state) => {
  if (!state) return 0;
  if (state.status === "playing" && state.anchorEpochMs) {
    return (
      (Number(state.anchorTime) || 0) +
      Math.max(0, (Date.now() - Number(state.anchorEpochMs)) / 1000)
    );
  }
  return Number(state.anchorTime ?? state.currentTime ?? 0);
};

const defaultPlaybackEntry = () => ({
  status: "idle",
  ads: [],
  adIndex: 0,
  currentVideo: null,
  pausedVideoPath: null,
  currentTime: 0,
  anchorTime: 0,
  anchorEpochMs: null,
  lastTimeUpdatedAt: null,
  companyId: null,
  locationId: null,
  startedBy: null,
});

const findLocationClockPeer = (
  locationId,
  excludeDeviceId,
  targetAdsSig = null
) => {
  if (!locationId) return null;
  const locStr = String(locationId);
  let bestMatch = null;

  for (const screen of activeScreens.values()) {
    if (screen.deviceId === excludeDeviceId) continue;
    if (String(screen.locationId || "") !== locStr) continue;
    if (!screen.currentVideo || screen.currentVideo === "PAUSED") continue;

    const peerState = devicePlaybackState.get(screen.deviceId);
    if (
      !peerState ||
      peerState.status !== "playing" ||
      !peerState.ads?.length
    ) {
      continue;
    }

    if (targetAdsSig) {
      const peerSig = peerState.ads.map((a) => String(a._id)).join(",");
      if (peerSig !== targetAdsSig) continue;
    }

    if (
      !bestMatch ||
      new Date(screen.connectedAt).getTime() <
        new Date(bestMatch.connectedAt).getTime()
    ) {
      const peerLiveTime = computeClockTime(peerState);
      bestMatch = {
        deviceId: screen.deviceId,
        connectedAt: screen.connectedAt,
        currentVideo: peerState.currentVideo || screen.currentVideo,
        adIndex: Number.isInteger(peerState.adIndex) ? peerState.adIndex : 0,
        anchorTime: Number(peerState.anchorTime) || 0,
        anchorEpochMs: peerState.anchorEpochMs || Date.now(),
        currentTime: peerLiveTime,
        ads: peerState.ads,
        startedBy: peerState.startedBy || null,
      };
    }
  }

  return bestMatch;
};

module.exports = {
  add: (
    deviceId,
    locationId,
    locationName,
    currentVideo = null,
    socketId = null,
    companyName = "Unknown",
    companyId = null
  ) => {
    activeScreens.set(deviceId, {
      deviceId,
      locationId,
      locationName,
      currentVideo,
      socketId,
      companyName,
      companyId: companyId ? String(companyId) : null,
      connectedAt: new Date(),
    });
  },

  get: (deviceId) => activeScreens.get(deviceId),

  updateVideo: (deviceId, currentVideo, currentTime = null) => {
    if (activeScreens.has(deviceId)) {
      const data = activeScreens.get(deviceId);
      data.currentVideo = currentVideo;

      if (currentTime !== null && currentTime !== undefined) {
        data.currentTime = Number(currentTime) || 0;
        data.lastTimeUpdatedAt = Date.now();
      }

      activeScreens.set(deviceId, data);
    }
  },

  findLocationClockPeer,

  findLiveSyncPeer: findLocationClockPeer,

  startPlaybackClock: (
    deviceId,
    {
      ads = [],
      companyId = null,
      locationId = null,
      startedBy = null,
      anchorEpochMs = Date.now(),
      inheritLocationPeer = true,
    } = {}
  ) => {
    const prev = devicePlaybackState.get(deviceId) || defaultPlaybackEntry();
    const adsSig = ads.map((a) => String(a._id)).join(",");
    const peer =
      inheritLocationPeer && locationId
        ? findLocationClockPeer(locationId, deviceId, adsSig)
        : null;

    let currentVideo = ads[0]?.videoPath || null;
    let adIndex = 0;
    let anchorTime = 0;
    let effectiveEpoch = anchorEpochMs;

    if (peer) {
      currentVideo = peer.currentVideo || currentVideo;
      const matchedIdx = ads.findIndex((a) => a.videoPath === currentVideo);
      adIndex = matchedIdx >= 0 ? matchedIdx : peer.adIndex || 0;
      anchorTime = Number(peer.anchorTime) || 0;
      effectiveEpoch = peer.anchorEpochMs || Date.now();
    }

    const next = {
      ...prev,
      status: "playing",
      ads,
      adIndex,
      currentVideo,
      pausedVideoPath: null,
      anchorTime,
      anchorEpochMs: effectiveEpoch,
      lastTimeUpdatedAt: Date.now(),
      companyId: companyId ? String(companyId) : prev.companyId,
      locationId: locationId ? String(locationId) : prev.locationId,
      startedBy: startedBy ?? prev.startedBy,
    };

    const liveTime = computeClockTime(next);
    next.currentTime = liveTime;
    devicePlaybackState.set(deviceId, next);

    if (activeScreens.has(deviceId)) {
      const data = activeScreens.get(deviceId);
      data.currentVideo = currentVideo;
      data.currentTime = liveTime;
      data.lastTimeUpdatedAt = Date.now();
      activeScreens.set(deviceId, data);
    }

    return { ...next, currentTime: liveTime };
  },

  pausePlaybackClock: (deviceId) => {
    const prev = devicePlaybackState.get(deviceId) || defaultPlaybackEntry();
    const frozenTime = computeClockTime(prev);
    const pausedVideoPath =
      prev.currentVideo && prev.currentVideo !== "PAUSED"
        ? prev.currentVideo
        : prev.pausedVideoPath || null;

    const next = {
      ...prev,
      status: "paused",
      currentVideo: "PAUSED",
      pausedVideoPath,
      anchorTime: frozenTime,
      anchorEpochMs: null,
      currentTime: frozenTime,
      lastTimeUpdatedAt: Date.now(),
    };
    devicePlaybackState.set(deviceId, next);
    module.exports.updateVideo(deviceId, "PAUSED", frozenTime);
    return next;
  },

  resumePlaybackClock: (deviceId) => {
    const prev = devicePlaybackState.get(deviceId);
    if (!prev) return null;

    const resumedVideo =
      prev.pausedVideoPath ||
      prev.ads?.[prev.adIndex || 0]?.videoPath ||
      prev.ads?.[0]?.videoPath ||
      null;
    const anchorTime = Number(prev.anchorTime ?? prev.currentTime ?? 0);
    const now = Date.now();

    const next = {
      ...prev,
      status: "playing",
      currentVideo: resumedVideo,
      pausedVideoPath: null,
      anchorTime,
      anchorEpochMs: now,
      currentTime: anchorTime,
      lastTimeUpdatedAt: now,
    };
    devicePlaybackState.set(deviceId, next);
    module.exports.updateVideo(deviceId, resumedVideo, anchorTime);
    return { ...next, currentTime: computeClockTime(next) };
  },

  advancePlaybackAd: (deviceId, { videoPath, currentTime = 0 } = {}) => {
    const prev = devicePlaybackState.get(deviceId);
    if (!prev) return null;

    const idx = (prev.ads || []).findIndex((a) => a.videoPath === videoPath);
    const adIndex = idx >= 0 ? idx : prev.adIndex || 0;
    const now = Date.now();
    const startSec = Number(currentTime) || 0;

    const next = {
      ...prev,
      status: "playing",
      adIndex,
      currentVideo: videoPath,
      pausedVideoPath: null,
      anchorTime: startSec,
      anchorEpochMs: now,
      currentTime: startSec,
      lastTimeUpdatedAt: now,
    };
    devicePlaybackState.set(deviceId, next);
    module.exports.updateVideo(deviceId, videoPath, startSec);
    return { ...next, currentTime: computeClockTime(next) };
  },

  getAuthoritativePlayback: (deviceId) => {
    const state = devicePlaybackState.get(deviceId);
    if (!state) return null;
    return {
      status: state.status,
      ads: state.ads || [],
      adIndex: Number.isInteger(state.adIndex) ? state.adIndex : 0,
      currentVideo: state.currentVideo || null,
      currentTime: computeClockTime(state),
      anchorTime: Number(state.anchorTime) || 0,
      anchorEpochMs: state.anchorEpochMs || null,
      startedBy: state.startedBy || null,
    };
  },

  getLiveEstimatedTime: (deviceId) => {
    const auth = module.exports.getAuthoritativePlayback(deviceId);
    if (auth && auth.status === "playing" && auth.currentVideo) {
      return {
        currentVideo: auth.currentVideo,
        currentTime: auth.currentTime,
        adIndex: auth.adIndex,
      };
    }

    const screen = activeScreens.get(deviceId);
    if (!screen || !screen.currentVideo || screen.currentVideo === "PAUSED") {
      return null;
    }
    const elapsedSec = screen.lastTimeUpdatedAt
      ? Math.max(0, (Date.now() - screen.lastTimeUpdatedAt) / 1000)
      : 0;
    return {
      currentVideo: screen.currentVideo,
      currentTime: (Number(screen.currentTime) || 0) + elapsedSec,
      adIndex: 0,
    };
  },

  updateSocketId: (deviceId, socketId) => {
    if (activeScreens.has(deviceId)) {
      const data = activeScreens.get(deviceId);
      data.socketId = socketId;
      activeScreens.set(deviceId, data);
    }
  },

  remove: (deviceId) => activeScreens.delete(deviceId),

  removeBySocketId: (socketId) => {
    const removedIds = [];
    for (const [key, screen] of activeScreens.entries()) {
      if (screen.socketId === socketId) {
        activeScreens.delete(key);
        removedIds.push(key);
      }
    }
    return removedIds;
  },

  setPlaybackState: (deviceId, patch = {}) => {
    if (!deviceId) return null;
    const prev = devicePlaybackState.get(deviceId) || defaultPlaybackEntry();
    const next = { ...prev, ...patch };
    devicePlaybackState.set(deviceId, next);
    return next;
  },

  getPlaybackState: (deviceId) => devicePlaybackState.get(deviceId) || null,

  clearPlaybackState: (deviceId) => devicePlaybackState.delete(deviceId),

  setEmergencyOverride: (deviceId, alert) => {
    if (!deviceId) return;
    emergencyOverrides.set(deviceId, alert);
  },

  getEmergencyOverride: (deviceId) => emergencyOverrides.get(deviceId) || null,

  clearEmergencyOverride: (deviceId) => emergencyOverrides.delete(deviceId),

  registerCompanyMonitorRoom: (companyId) => {
    if (companyId) {
      companyMonitorRooms.add(String(companyId));
    }
  },

  list: () => {
    const serverNow = Date.now();
    return Array.from(activeScreens.values()).map((screen) => {
      const state = devicePlaybackState.get(screen.deviceId);
      let liveTime = Number(screen.currentTime) || 0;

      if (state && (state.status === "playing" || state.status === "paused")) {
        liveTime = computeClockTime(state);
      } else if (
        screen.currentVideo &&
        screen.currentVideo !== "PAUSED" &&
        screen.lastTimeUpdatedAt &&
        typeof screen.currentTime === "number"
      ) {
        liveTime =
          screen.currentTime +
          Math.max(0, (serverNow - screen.lastTimeUpdatedAt) / 1000);
      }

      return {
        ...screen,
        currentTime: liveTime,
        serverNow,
        playbackStatus:
          screen.currentVideo === "PAUSED"
            ? "paused"
            : screen.currentVideo
              ? "playing"
              : "idle",
      };
    });
  },

  broadcastLiveScreens: (io) => {
    if (!io) return;
    const screens = module.exports.list();
    io.to("admin_monitors").emit("live_screens_update", screens);

    const byCompany = new Map();
    screens.forEach((screen) => {
      if (screen.companyId) {
        if (!byCompany.has(screen.companyId)) {
          byCompany.set(screen.companyId, []);
        }
        byCompany.get(screen.companyId).push(screen);
      }
    });

    const targetCompanyIds = new Set([
      ...companyMonitorRooms,
      ...byCompany.keys(),
    ]);

    targetCompanyIds.forEach((cid) => {
      io.to(`company_monitors_${cid}`).emit(
        "live_screens_update",
        byCompany.get(cid) || []
      );
    });
  },
};
