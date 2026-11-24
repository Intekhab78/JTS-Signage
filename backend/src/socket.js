const jwt = require("jsonwebtoken");
const activeScreens = require("./activeScreens");
const Location = require("./models/Location");
const Device = require("./models/Device");
const playLogStore = require("./utils/playLogStore");
const pairingStore = require("./utils/pairingStore");
const adScheduler = require("./scheduler/adScheduler");

const lastDbSyncByDevice = new Map();
const DB_SYNC_INTERVAL_MS = 10000;

module.exports = (io) => {
  if (!io.__vmsSyncIntervalStarted) {
    io.__vmsSyncIntervalStarted = true;
    const syncTimer = setInterval(() => {
      const screens = activeScreens.list();
      let hasPlaying = false;

      screens.forEach((screen) => {
        const auth = activeScreens.getAuthoritativePlayback(screen.deviceId);
        if (auth && auth.status === "playing" && auth.currentVideo) {
          hasPlaying = true;
          io.to(`device_${screen.deviceId}`).emit("sync_seek", {
            videoPath: auth.currentVideo,
            targetTime: auth.currentTime,
            adIndex: auth.adIndex,
            serverNow: Date.now(),
          });
        }
      });

      if (hasPlaying) {
        activeScreens.broadcastLiveScreens(io);
      }
    }, 2000);
    if (typeof syncTimer.unref === "function") {
      syncTimer.unref();
    }
  }

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    /**
     * 0️⃣ Admin / Company Admin monitor room subscription (JWT-verified)
     */
    socket.on("join_admin_monitors", (token) => {
      try {
        if (!token) {
          socket.emit("auth_error", {
            message: "Unauthorized monitor connection",
          });
          return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.role === "admin") {
          socket.join("admin_monitors");
          socket.emit("live_screens_update", activeScreens.list());
          return;
        }

        if (decoded?.role === "company_admin" && decoded?.company_id) {
          const cid = String(decoded.company_id);
          activeScreens.registerCompanyMonitorRoom(cid);
          socket.join(`company_monitors_${cid}`);
          const companyScreens = activeScreens
            .list()
            .filter((s) => s.companyId === cid);
          socket.emit("live_screens_update", companyScreens);
          return;
        }

        socket.emit("auth_error", {
          message: "Unauthorized monitor connection",
        });
      } catch {
        socket.emit("auth_error", {
          message: "Unauthorized monitor connection",
        });
      }
    });

    /**
     * 📺 TV Pairing Room Subscription
     */
    socket.on("join_pairing_code", async (rawCode) => {
      try {
        const code = String(rawCode || "").trim();
        if (!code) return;

        socket.join(`pair_${code}`);

        const session = pairingStore.attachSocket(code, socket.id);

        if (session?.status === "paired" && session?.screenToken) {
          socket.emit("device_paired", {
            screenToken: session.screenToken,
            deviceId: session.pairedDeviceId,
          });
        }
      } catch (err) {
        console.error("Pairing socket error:", err.message);
      }
    });

    /**
     * 1️⃣ Register device + JOIN DEVICE ROOM + RESTORE PLAYBACK STATE
     */
    socket.on("register_device", async ({ deviceId, locationId }) => {
      if (!deviceId) return;

      let device = null;
      try {
        device = await Device.findOne({ deviceId })
          .populate("company_id", "name")
          .populate("currentPlaylist");
      } catch (err) {
        console.error("Device fetch error:", err);
        return;
      }

      if (!device) {
        return;
      }

      socket.join(`device_${deviceId}`);

      Device.updateOne(
        { deviceId },
        { $set: { isOnline: true, lastSeen: new Date() } }
      ).catch((err) =>
        console.error("Device online status update error:", err.message)
      );

      let locationName = "Unknown Location";
      const companyId = device.company_id?._id || device.company_id || null;
      const companyName = device.company_id?.name || "Unknown Company";

      if (locationId) {
        try {
          const location = await Location.findById(locationId);
          if (location) locationName = location.name;
        } catch (err) {
          console.error("Location error:", err);
        }
      }

      const existingActive = activeScreens.get(deviceId);
      const hasPrimarySocket =
        existingActive?.socketId &&
        existingActive.socketId !== socket.id &&
        io.sockets.sockets.has(existingActive.socketId);

      if (!hasPrimarySocket) {
        activeScreens.add(
          deviceId,
          locationId,
          locationName,
          existingActive?.currentVideo || null,
          socket.id,
          companyName,
          companyId
        );
      }

      // Push saved screen display/audio settings
      socket.emit("screen_settings_update", {
        volume: device.settings?.volume ?? 100,
        muted: device.settings?.muted ?? false,
        orientation: device.settings?.orientation ?? "0",
      });

      // Push active emergency override if present and not expired
      const override = activeScreens.getEmergencyOverride(deviceId);
      if (override) {
        const isExpired =
          override.expiresAt && new Date(override.expiresAt) <= new Date();
        if (isExpired) {
          activeScreens.clearEmergencyOverride(deviceId);
        } else {
          socket.emit("emergency_override", override);
        }
      }

      let savedState = activeScreens.getPlaybackState(deviceId);

      // Server-restart recovery from MongoDB persisted state
      if (
        !savedState &&
        (device.playbackStatus === "playing" ||
          device.playbackStatus === "paused")
      ) {
        const restoredAds = (device.currentPlaylist || [])
          .filter((a) => a && a.isActive !== false)
          .sort((a, b) => (a.playOrder || 1) - (b.playOrder || 1));

        if (restoredAds.length > 0) {
          if (device.playbackStatus === "playing") {
            savedState = activeScreens.startPlaybackClock(deviceId, {
              ads: restoredAds,
              companyId,
              locationId,
              startedBy: device.playbackStartedBy || null,
              anchorEpochMs:
                Date.now() - Math.round((Number(device.currentTime) || 0) * 1000),
              inheritLocationPeer: true,
            });
          } else {
            savedState = activeScreens.setPlaybackState(deviceId, {
              status: "paused",
              ads: restoredAds,
              adIndex: Math.max(
                0,
                restoredAds.findIndex((a) => a.videoPath === device.currentVideo)
              ),
              currentVideo: "PAUSED",
              pausedVideoPath:
                device.currentVideo && device.currentVideo !== "PAUSED"
                  ? device.currentVideo
                  : restoredAds[0]?.videoPath || null,
              currentTime: device.currentTime || 0,
              anchorTime: device.currentTime || 0,
              anchorEpochMs: null,
              startedBy: device.playbackStartedBy || null,
            });
          }
        }
      }

      if (
        savedState &&
        Array.isArray(savedState.ads) &&
        savedState.ads.length > 0 &&
        (savedState.status === "playing" || savedState.status === "paused")
      ) {
        let syncTime = Number(savedState.anchorTime ?? savedState.currentTime ?? 0);
        let startIndex = Number.isInteger(savedState.adIndex)
          ? savedState.adIndex
          : 0;
        let restoredVideo =
          savedState.status === "paused"
            ? "PAUSED"
            : savedState.currentVideo || savedState.ads[startIndex]?.videoPath || null;

        if (savedState.status === "playing") {
          const savedSig = savedState.ads.map((a) => String(a._id)).join(",");
          const peer =
            !hasPrimarySocket && locationId
              ? activeScreens.findLocationClockPeer(locationId, deviceId, savedSig)
              : null;

          if (peer && peer.anchorEpochMs) {
            const matchedIdx = Math.max(
              0,
              savedState.ads.findIndex((a) => a.videoPath === peer.currentVideo)
            );
            restoredVideo = savedState.ads[matchedIdx]?.videoPath || peer.currentVideo;
            startIndex = matchedIdx;
            activeScreens.setPlaybackState(deviceId, {
              currentVideo: restoredVideo,
              adIndex: startIndex,
              anchorTime: peer.anchorTime,
              anchorEpochMs: peer.anchorEpochMs,
              lastTimeUpdatedAt: Date.now(),
            });
          }

          const auth = activeScreens.getAuthoritativePlayback(deviceId);
          if (auth) {
            syncTime = auth.currentTime;
            restoredVideo = auth.currentVideo || restoredVideo;
            startIndex = auth.adIndex;
          }
        }

        if (!hasPrimarySocket) {
          activeScreens.updateVideo(deviceId, restoredVideo, syncTime);
        }

        socket.emit("play_ads", {
          deviceId,
          ads: savedState.ads,
          resume: savedState.status === "paused",
          startPaused: savedState.status === "paused",
          resumeTime: syncTime,
          startIndex,
          serverNow: Date.now(),
        });
      } else if (savedState?.status !== "paused" && locationId) {
        const peer = activeScreens.findLocationClockPeer(locationId, deviceId);
        if (peer) {
          const matchingAds = peer.ads.filter(
            (ad) =>
              !Array.isArray(ad.deviceId) ||
              ad.deviceId.length === 0 ||
              ad.deviceId.includes(deviceId)
          );
          if (matchingAds.length > 0) {
            const clock = activeScreens.startPlaybackClock(deviceId, {
              ads: matchingAds,
              companyId,
              locationId,
              startedBy: peer.startedBy,
              inheritLocationPeer: true,
            });

            socket.emit("play_ads", {
              deviceId,
              ads: matchingAds,
              resumeTime: clock.currentTime,
              startIndex: clock.adIndex,
              serverNow: Date.now(),
            });
          }
        }
      }

      activeScreens.broadcastLiveScreens(io);
      adScheduler.trigger();
    });

    /**
     * 🔄 Explicit instant resync request (e.g. tab visibility restore)
     */
    socket.on("request_sync", ({ deviceId }) => {
      if (!deviceId) return;
      const auth = activeScreens.getAuthoritativePlayback(deviceId);
      if (auth && auth.status === "playing" && auth.currentVideo) {
        socket.emit("sync_seek", {
          videoPath: auth.currentVideo,
          targetTime: auth.currentTime,
          adIndex: auth.adIndex,
          serverNow: Date.now(),
        });
      }
    });

    /**
     * 2️⃣ Update currently playing video (Authoritative Clock Protection + Drift Sync + DB Persistence)
     */
    socket.on("playing_video", ({ deviceId, videoPath, currentTime }) => {
      if (!deviceId) return;

      const screen = activeScreens.get(deviceId);
      const isSecondarySocket =
        screen?.socketId &&
        screen.socketId !== socket.id &&
        io.sockets.sockets.has(screen.socketId);

      if (isSecondarySocket) {
        const primaryAuth = activeScreens.getAuthoritativePlayback(deviceId);
        if (
          primaryAuth &&
          primaryAuth.status === "playing" &&
          primaryAuth.currentVideo === videoPath &&
          currentTime != null &&
          Math.abs(Number(currentTime) - primaryAuth.currentTime) > 0.75
        ) {
          socket.emit("sync_seek", {
            videoPath: primaryAuth.currentVideo,
            targetTime: primaryAuth.currentTime,
            adIndex: primaryAuth.adIndex,
            serverNow: Date.now(),
          });
        }
        return;
      }

      const playbackStatus =
        videoPath === "PAUSED"
          ? "paused"
          : videoPath
            ? "playing"
            : "stopped";

      const prevAuth = activeScreens.getAuthoritativePlayback(deviceId);
      let authoritativeTime = Number(currentTime) || 0;

      if (playbackStatus === "playing") {
        if (prevAuth && prevAuth.ads?.length) {
          if (prevAuth.currentVideo && prevAuth.currentVideo !== videoPath) {
            const mySig = prevAuth.ads.map((a) => String(a._id)).join(",");
            const master = screen?.locationId
              ? activeScreens.findLocationClockPeer(
                  screen.locationId,
                  deviceId,
                  mySig
                )
              : null;
            const isMaster =
              !master ||
              !screen?.connectedAt ||
              new Date(screen.connectedAt).getTime() <=
                new Date(master.connectedAt).getTime();

            if (isMaster) {
              // Primary screen naturally advanced to next ad in multi-ad playlist
              const advanced = activeScreens.advancePlaybackAd(deviceId, {
                videoPath,
                currentTime: Number(currentTime) || 0,
              });
              authoritativeTime = advanced?.currentTime ?? 0;

              if (screen?.locationId && advanced) {
                activeScreens.list().forEach((peerScreen) => {
                  if (peerScreen.deviceId === deviceId) return;
                  if (
                    String(peerScreen.locationId || "") !==
                    String(screen.locationId)
                  ) {
                    return;
                  }
                  const peerAuth = activeScreens.getAuthoritativePlayback(
                    peerScreen.deviceId
                  );
                  if (!peerAuth || peerAuth.status !== "playing") return;
                  const peerSig = (peerAuth.ads || [])
                    .map((a) => String(a._id))
                    .join(",");
                  if (peerSig !== mySig) return;

                  activeScreens.setPlaybackState(peerScreen.deviceId, {
                    currentVideo: advanced.currentVideo,
                    adIndex: advanced.adIndex,
                    anchorTime: advanced.anchorTime,
                    anchorEpochMs: advanced.anchorEpochMs,
                    lastTimeUpdatedAt: Date.now(),
                  });
                  activeScreens.updateVideo(
                    peerScreen.deviceId,
                    advanced.currentVideo,
                    advanced.currentTime
                  );
                  io.to(`device_${peerScreen.deviceId}`).emit("sync_seek", {
                    videoPath: advanced.currentVideo,
                    targetTime: advanced.currentTime,
                    adIndex: advanced.adIndex,
                    serverNow: Date.now(),
                  });
                });
              }
            } else if (master) {
              authoritativeTime = master.currentTime;
              activeScreens.setPlaybackState(deviceId, {
                currentVideo: master.currentVideo,
                adIndex: master.adIndex,
                anchorTime: master.anchorTime,
                anchorEpochMs: master.anchorEpochMs,
                lastTimeUpdatedAt: Date.now(),
              });
              activeScreens.updateVideo(
                deviceId,
                master.currentVideo,
                master.currentTime
              );
              if (master.currentVideo !== videoPath) {
                socket.emit("sync_seek", {
                  videoPath: master.currentVideo,
                  targetTime: master.currentTime,
                  adIndex: master.adIndex,
                  serverNow: Date.now(),
                });
              }
            }
          } else {
            // Keep authoritative wall-clock anchor untouched so background throttling cannot drag clock back
            authoritativeTime = prevAuth.currentTime;
            activeScreens.updateVideo(deviceId, videoPath, authoritativeTime);

            const mySig = prevAuth.ads.map((a) => String(a._id)).join(",");
            const master = screen?.locationId
              ? activeScreens.findLocationClockPeer(
                  screen.locationId,
                  deviceId,
                  mySig
                )
              : null;

            if (
              master &&
              screen?.connectedAt &&
              new Date(master.connectedAt).getTime() <
                new Date(screen.connectedAt).getTime()
            ) {
              const clockSkew =
                Math.abs(master.currentTime - authoritativeTime) > 0.75 ||
                master.currentVideo !== videoPath;
              const playerDrift =
                currentTime != null &&
                (master.currentVideo !== videoPath ||
                  Math.abs(Number(currentTime) - master.currentTime) > 0.75);

              if (clockSkew) {
                const syncedIdx = Math.max(
                  0,
                  prevAuth.ads.findIndex((a) => a.videoPath === master.currentVideo)
                );
                activeScreens.setPlaybackState(deviceId, {
                  currentVideo: master.currentVideo,
                  adIndex: syncedIdx,
                  anchorTime: master.anchorTime,
                  anchorEpochMs: master.anchorEpochMs,
                  lastTimeUpdatedAt: Date.now(),
                });
                authoritativeTime = master.currentTime;
              }

              if (playerDrift) {
                socket.emit("sync_seek", {
                  videoPath: master.currentVideo,
                  targetTime: master.currentTime,
                  adIndex: master.adIndex,
                  serverNow: Date.now(),
                });
              }
            }
          }
        } else {
          activeScreens.updateVideo(deviceId, videoPath, currentTime);
          activeScreens.setPlaybackState(deviceId, {
            currentVideo: videoPath,
            ...(currentTime != null
              ? {
                  currentTime: Number(currentTime) || 0,
                  anchorTime: Number(currentTime) || 0,
                  anchorEpochMs: Date.now(),
                  lastTimeUpdatedAt: Date.now(),
                }
              : {}),
            status: playbackStatus,
          });
        }
      } else {
        activeScreens.updateVideo(deviceId, videoPath, currentTime);
        activeScreens.setPlaybackState(deviceId, {
          currentVideo: videoPath,
          ...(currentTime != null
            ? { currentTime: Number(currentTime) || 0, lastTimeUpdatedAt: Date.now() }
            : {}),
          status: playbackStatus,
          ...(playbackStatus === "stopped"
            ? { adIndex: 0, anchorTime: 0, anchorEpochMs: null, pausedVideoPath: null }
            : {}),
        });
      }

      const now = Date.now();
      const prevSync = lastDbSyncByDevice.get(deviceId);
      const shouldSyncDb =
        !prevSync ||
        prevSync.videoPath !== videoPath ||
        now - prevSync.time >= DB_SYNC_INTERVAL_MS;

      if (shouldSyncDb) {
        lastDbSyncByDevice.set(deviceId, { time: now, videoPath });
        Device.updateOne(
          { deviceId },
          {
            $set: {
              isOnline: true,
              lastSeen: new Date(),
              currentVideo: videoPath,
              currentTime: authoritativeTime,
              playbackStatus,
            },
          }
        ).catch((err) =>
          console.error("Device playing_video DB sync error:", err.message)
        );
      }

      activeScreens.broadcastLiveScreens(io);
    });

    /**
     * 📊 Proof-of-Play log event from TV player
     */
    socket.on(
      "ad_played",
      async ({
        deviceId,
        advertisementId,
        adTitle,
        mediaType,
        durationSeconds,
        startedAt,
        endedAt,
      }) => {
        if (!deviceId) return;
        try {
          const device = await Device.findOne({ deviceId })
            .populate("company_id", "name")
            .populate("location_id", "name");
          if (!device) return;

          const primaryLocation = Array.isArray(device.location_id)
            ? device.location_id[0]
            : device.location_id;

          await playLogStore.recordPlayLog({
            advertisementId,
            adTitle,
            mediaType,
            deviceId,
            deviceName: device.deviceName || "",
            companyId: device.company_id?._id || device.company_id || undefined,
            companyName: device.company_id?.name || "",
            locationId: primaryLocation?._id || primaryLocation || undefined,
            locationName: primaryLocation?.name || "",
            startedAt,
            endedAt,
            durationSeconds,
          });
        } catch (err) {
          console.error("PlayLog insert error:", err.message);
        }
      }
    );

    /**
     * 3️⃣ Remove screen on disconnect & mark offline
     */
    socket.on("disconnect", () => {
      const prevSnapshots = new Map();
      activeScreens.list().forEach((s) => prevSnapshots.set(s.deviceId, s));

      const removedDeviceIds = activeScreens.removeBySocketId(socket.id) || [];

      removedDeviceIds.forEach((deviceId) => {
        const room = io.sockets.adapter.rooms.get(`device_${deviceId}`);
        if (room && room.size > 0) {
          const nextSocketId = Array.from(room)[0];
          const snap = prevSnapshots.get(deviceId);
          activeScreens.add(
            deviceId,
            snap?.locationId || null,
            snap?.locationName || "Unknown Location",
            snap?.currentVideo || null,
            nextSocketId,
            snap?.companyName || "Unknown Company",
            snap?.companyId || null
          );
          if (snap?.currentTime != null) {
            activeScreens.updateVideo(
              deviceId,
              snap.currentVideo || null,
              snap.currentTime
            );
          }
          return;
        }

        lastDbSyncByDevice.delete(deviceId);
        adScheduler.resetScheduleCache(deviceId);
        Device.updateOne(
          { deviceId },
          { $set: { isOnline: false, lastSeen: new Date() } }
        ).catch((err) =>
          console.error("Device disconnect DB update error:", err.message)
        );
      });

      activeScreens.broadcastLiveScreens(io);
    });
  });
};
