const Advertisement = require("../models/Advertisement");
const Device = require("../models/Device");
const storageService = require("../services/storage.service");
const socketInstance = require("../socketInstance");
const activeScreens = require("../activeScreens");
const adScheduler = require("../scheduler/adScheduler");

const parseJsonArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const adBelongsToTenant = (ad, req) => {
  if (req.user?.role !== "company_admin") return true;
  const companyId = String(req.user.company_id || "");
  return (ad.company_ids || []).some(
    (c) => String(c._id || c) === companyId
  );
};

const persistDevicePlayback = (
  deviceId,
  { status, ads, currentVideo, currentTime, startedBy }
) => {
  if (!deviceId) return;
  const update = { playbackStatus: status };
  if (ads !== undefined) update.currentPlaylist = ads.map((a) => a._id);
  if (currentVideo !== undefined) update.currentVideo = currentVideo;
  if (currentTime !== undefined) update.currentTime = currentTime;
  if (startedBy !== undefined) update.playbackStartedBy = startedBy;

  Device.updateOne({ deviceId }, { $set: update }).catch((err) =>
    console.error("Device playback persist error:", err.message)
  );
};

const findAdsForDevice = async (
  deviceId,
  { companyId, companyIds, locationId, locationIds } = {}
) => {
  const deviceDoc = await Device.findOne({ deviceId });

  const query = {
    isActive: true,
    $or: [{ deviceId: { $in: [deviceId] } }, { deviceId: { $size: 0 } }],
  };

  if (deviceDoc?.company_id) {
    query.company_ids = deviceDoc.company_id;
  } else if (Array.isArray(companyIds) && companyIds.length) {
    query.company_ids = { $in: companyIds };
  } else if (companyId) {
    query.company_ids = companyId;
  }

  const requestedLocs =
    Array.isArray(locationIds) && locationIds.length
      ? locationIds.map(String)
      : locationId
        ? [String(locationId)]
        : [];

  if (deviceDoc?.location_id?.length) {
    const deviceLocs = deviceDoc.location_id.map(String);
    const intersected = requestedLocs.length
      ? deviceLocs.filter((id) => requestedLocs.includes(id))
      : [];
    const effectiveLocations = intersected.length ? intersected : deviceLocs;
    query.location_ids = { $in: effectiveLocations };
  } else if (requestedLocs.length) {
    query.location_ids = { $in: requestedLocs };
  }

  return Advertisement.find(query).sort({ priority: -1, playOrder: 1 });
};

/* =======================================================
   ✅ CREATE ADVERTISEMENT (MULTI COMPANY + LOCATION + SCHEDULE + MEDIA)
======================================================= */
exports.createAdvertisement = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Media file is required",
      });
    }

    let company_ids = parseJsonArray(req.body.company_ids) || [];
    if (req.user?.role === "company_admin") {
      company_ids = req.user.company_id ? [req.user.company_id] : [];
    }

    const location_ids = parseJsonArray(req.body.location_ids) || [];
    const deviceIds =
      parseJsonArray(req.body.deviceIds) ??
      parseJsonArray(req.body.deviceId) ??
      [];
    const days = parseJsonArray(req.body.days) || [];

    const {
      title,
      description,
      playOrder,
      displayDuration,
      tickerText,
      priority,
      isFallback,
      startDate,
      endDate,
      startTime,
      endTime,
    } = req.body;

    const mediaType = req.file.mimetype.startsWith("image/")
      ? "image"
      : "video";
    const publicVideoPath = await storageService.saveVideo(req.file);

    const advertisement = await Advertisement.create({
      company_ids,
      location_ids,
      deviceId: deviceIds,
      title,
      description,
      playOrder: playOrder ? Number(playOrder) : 1,
      videoPath: publicVideoPath,
      mediaType,
      displayDuration: displayDuration ? Number(displayDuration) : 10,
      tickerText: tickerText ? String(tickerText).trim() : "",
      priority: priority ? Number(priority) : 1,
      isFallback: isFallback === true || isFallback === "true",
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      startTime: startTime || "",
      endTime: endTime || "",
      days,
    });

    adScheduler.resetScheduleCache();
    adScheduler.trigger();

    res.status(201).json({
      success: true,
      message: "Advertisement created successfully",
      data: advertisement,
    });
  } catch (error) {
    console.error("Create Ad Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =======================================================
   ✅ LIST ADVERTISEMENTS (TENANT-SCOPED)
======================================================= */
exports.listAdvertisements = async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.user?.role === "company_admin") {
      query.company_ids = req.user.company_id;
    }

    const ads = await Advertisement.find(query)
      .populate("company_ids", "name")
      .populate("location_ids", "name")
      .sort({ playOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: ads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =======================================================
   ✅ VIEW SINGLE ADVERTISEMENT
======================================================= */
exports.viewAdvertisement = async (req, res) => {
  try {
    const advertisement = await Advertisement.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .populate("company_ids", "name")
      .populate("location_ids", "name");

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found",
      });
    }

    if (!adBelongsToTenant(advertisement, req)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: advertisement,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/* =======================================================
   ✅ UPDATE ADVERTISEMENT
======================================================= */
exports.updateAdvertisement = async (req, res) => {
  try {
    const existingAd = await Advertisement.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!existingAd) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found or inactive",
      });
    }

    if (!adBelongsToTenant(existingAd, req)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const updateData = { ...req.body };

    if (req.user?.role === "company_admin") {
      updateData.company_ids = req.user.company_id ? [req.user.company_id] : [];
    } else if (updateData.company_ids !== undefined) {
      updateData.company_ids = parseJsonArray(updateData.company_ids) ?? [];
    }

    if (updateData.location_ids !== undefined) {
      updateData.location_ids = parseJsonArray(updateData.location_ids) ?? [];
    }

    if (updateData.deviceIds !== undefined) {
      updateData.deviceId = parseJsonArray(updateData.deviceIds) ?? [];
      delete updateData.deviceIds;
    } else if (updateData.deviceId !== undefined) {
      updateData.deviceId = parseJsonArray(updateData.deviceId) ?? [];
    }

    if (updateData.days !== undefined) {
      updateData.days = parseJsonArray(updateData.days) ?? [];
    }

    if (updateData.startDate === "") updateData.startDate = null;
    if (updateData.endDate === "") updateData.endDate = null;
    if (updateData.playOrder !== undefined && updateData.playOrder !== "") {
      updateData.playOrder = Number(updateData.playOrder);
    }
    if (
      updateData.displayDuration !== undefined &&
      updateData.displayDuration !== ""
    ) {
      updateData.displayDuration = Number(updateData.displayDuration);
    }
    if (updateData.priority !== undefined && updateData.priority !== "") {
      updateData.priority = Number(updateData.priority);
    }
    if (updateData.isFallback !== undefined) {
      updateData.isFallback =
        updateData.isFallback === true || updateData.isFallback === "true";
    }
    if (updateData.tickerText !== undefined) {
      updateData.tickerText = String(updateData.tickerText).trim();
    }

    if (req.file) {
      updateData.mediaType = req.file.mimetype.startsWith("image/")
        ? "image"
        : "video";
      updateData.videoPath = await storageService.saveVideo(req.file);
    }

    const advertisement = await Advertisement.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      updateData,
      { new: true, runValidators: true }
    );

    if (
      req.file &&
      existingAd.videoPath &&
      existingAd.videoPath !== updateData.videoPath
    ) {
      await storageService.deleteVideo(existingAd.videoPath);
    }

    adScheduler.resetScheduleCache();

    const hasScheduleFields = Boolean(
      advertisement &&
        !advertisement.isFallback &&
        (advertisement.startDate ||
          advertisement.endDate ||
          advertisement.startTime ||
          advertisement.endTime ||
          (advertisement.days && advertisement.days.length > 0))
    );

    if (
      hasScheduleFields &&
      !adScheduler.isAdScheduledAt(advertisement, new Date())
    ) {
      try {
        const io = socketInstance.getIO();
        let stoppedAny = false;
        activeScreens.list().forEach((screen) => {
          if (
            screen.currentVideo === advertisement.videoPath ||
            screen.currentVideo === existingAd.videoPath
          ) {
            stoppedAny = true;
            io.to(`device_${screen.deviceId}`).emit("stop_ads", {
              deviceId: screen.deviceId,
            });
            activeScreens.updateVideo(screen.deviceId, null);
            activeScreens.setPlaybackState(screen.deviceId, {
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
            persistDevicePlayback(screen.deviceId, {
              status: "stopped",
              ads: [],
              currentVideo: null,
              currentTime: 0,
              startedBy: null,
            });
          }
        });
        if (stoppedAny) {
          activeScreens.broadcastLiveScreens(io);
        }
      } catch {
        // Socket.io not initialized during standalone tests
      }
    }

    adScheduler.trigger();

    res.status(200).json({
      success: true,
      message: "Advertisement updated successfully",
      data: advertisement,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/* =======================================================
   🔀 REORDER PLAYLIST ITEMS
======================================================= */
exports.reorderAdvertisements = async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "items array is required",
      });
    }

    if (req.user?.role === "company_admin") {
      const ids = items.map((item) => item.id);
      const ads = await Advertisement.find({ _id: { $in: ids } });
      const unauthorized = ads.some((ad) => !adBelongsToTenant(ad, req));
      if (unauthorized) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    const ops = items.map((item, idx) => ({
      updateOne: {
        filter: { _id: item.id, isActive: true },
        update: { $set: { playOrder: Number(item.playOrder) || idx + 1 } },
      },
    }));

    await Advertisement.bulkWrite(ops);

    res.status(200).json({
      success: true,
      message: "Playlist order updated",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/* =======================================================
   ✅ SOFT DELETE ADVERTISEMENT
======================================================= */
exports.deleteAdvertisement = async (req, res) => {
  try {
    const existingAd = await Advertisement.findById(req.params.id);
    if (!existingAd) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found",
      });
    }

    if (!adBelongsToTenant(existingAd, req)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const advertisement = await Advertisement.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (advertisement.videoPath) {
      const otherActiveCount = await Advertisement.countDocuments({
        isActive: true,
        videoPath: advertisement.videoPath,
      });

      if (otherActiveCount === 0) {
        await storageService.deleteVideo(advertisement.videoPath);
      }

      try {
        const io = socketInstance.getIO();
        let stoppedAny = false;

        activeScreens.list().forEach((screen) => {
          if (screen.currentVideo === advertisement.videoPath) {
            stoppedAny = true;
            io.to(`device_${screen.deviceId}`).emit("stop_ads", {
              deviceId: screen.deviceId,
            });
            activeScreens.updateVideo(screen.deviceId, null);
            activeScreens.setPlaybackState(screen.deviceId, {
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
            persistDevicePlayback(screen.deviceId, {
              status: "stopped",
              ads: [],
              currentVideo: null,
              currentTime: 0,
              startedBy: null,
            });
          }
        });

        if (stoppedAny) {
          activeScreens.broadcastLiveScreens(io);
        }
      } catch {
        // Socket.io not initialized during standalone tests
      }
    }

    res.status(200).json({
      success: true,
      message: "Advertisement deactivated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/* =======================================================
   ✅ PLAY ADS ON DEVICE
======================================================= */
exports.playAdvertisements = async (req, res) => {
  try {
    const { companyId, companyIds, deviceId, locationId, locationIds } = req.body;
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId required",
      });
    }

    const deviceDoc = await Device.findOne({ deviceId });
    if (
      req.user?.role === "company_admin" &&
      deviceDoc &&
      String(deviceDoc.company_id) !== String(req.user.company_id || "")
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const scopedCompanyId =
      req.user?.role === "company_admin" ? req.user.company_id : companyId;

    const ads = await findAdsForDevice(deviceId, {
      companyId: scopedCompanyId,
      companyIds:
        req.user?.role === "company_admin"
          ? [req.user.company_id]
          : companyIds,
      locationId,
      locationIds,
    });

    if (!ads.length) {
      return res.status(404).json({ success: false, message: "No ads found" });
    }

    const io = socketInstance.getIO();
    const screen = activeScreens.get(deviceId);
    const isPaused = screen?.currentVideo === "PAUSED";
    const effectiveLocationId =
      locationId || locationIds?.[0] || deviceDoc?.location_id?.[0] || null;

    let clock;
    if (isPaused) {
      clock =
        activeScreens.resumePlaybackClock(deviceId) ||
        activeScreens.startPlaybackClock(deviceId, {
          ads,
          companyId:
            scopedCompanyId || companyIds?.[0] || deviceDoc?.company_id || null,
          locationId: effectiveLocationId,
          startedBy: "manual",
          inheritLocationPeer: true,
        });
    } else {
      clock = activeScreens.startPlaybackClock(deviceId, {
        ads,
        companyId:
          scopedCompanyId || companyIds?.[0] || deviceDoc?.company_id || null,
        locationId: effectiveLocationId,
        startedBy: "manual",
        inheritLocationPeer: true,
      });
    }

    persistDevicePlayback(deviceId, {
      status: "playing",
      ads,
      currentVideo: clock.currentVideo || ads[0]?.videoPath || null,
      currentTime: clock.currentTime || 0,
      startedBy: "manual",
    });

    io.to(`device_${deviceId}`).emit("play_ads", {
      companyId: scopedCompanyId,
      deviceId,
      ads,
      resume: isPaused,
      resumeTime: clock.currentTime,
      startIndex: clock.adIndex,
      serverNow: Date.now(),
    });

    activeScreens.broadcastLiveScreens(io);

    res.json({ success: true, count: ads.length });
  } catch (error) {
    console.error("Play Ads Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =======================================================
   ✅ PLAY ADS BY LOCATION
======================================================= */
exports.playByLocation = async (req, res) => {
  try {
    let { locationId, companyId } = req.body;
    if (req.user?.role === "company_admin") {
      companyId = req.user.company_id;
    }

    if (!locationId) {
      return res.status(400).json({
        success: false,
        message: "locationId required",
      });
    }

    const devices = await Device.find({
      location_id: locationId,
      ...(companyId ? { company_id: companyId } : {}),
      status: "active",
    });

    const io = socketInstance.getIO();
    const playedDevices = [];
    const sharedEpoch = Date.now();

    for (const d of devices) {
      const ads = await findAdsForDevice(d.deviceId, { companyId, locationId });
      if (!ads.length) continue;

      const isPaused = activeScreens.get(d.deviceId)?.currentVideo === "PAUSED";
      const clock = isPaused
        ? activeScreens.resumePlaybackClock(d.deviceId) ||
          activeScreens.startPlaybackClock(d.deviceId, {
            ads,
            companyId: companyId || d.company_id || null,
            locationId,
            startedBy: "manual",
            anchorEpochMs: sharedEpoch,
            inheritLocationPeer: false,
          })
        : activeScreens.startPlaybackClock(d.deviceId, {
            ads,
            companyId: companyId || d.company_id || null,
            locationId,
            startedBy: "manual",
            anchorEpochMs: sharedEpoch,
            inheritLocationPeer: false,
          });

      persistDevicePlayback(d.deviceId, {
        status: "playing",
        ads,
        currentVideo: clock.currentVideo || ads[0]?.videoPath || null,
        currentTime: clock.currentTime || 0,
        startedBy: "manual",
      });

      io.to(`device_${d.deviceId}`).emit("play_ads", {
        companyId: companyId || d.company_id,
        deviceId: d.deviceId,
        ads,
        resume: isPaused,
        resumeTime: clock.currentTime,
        startIndex: clock.adIndex,
        serverNow: Date.now(),
      });

      playedDevices.push(d.deviceId);
    }

    activeScreens.broadcastLiveScreens(io);

    res.json({ success: true, playedDevices });
  } catch (error) {
    console.error("Play By Location Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =======================================================
   ✅ PLAY ADS BY COMPANY
======================================================= */
exports.playByCompany = async (req, res) => {
  try {
    let { companyId } = req.body;
    if (req.user?.role === "company_admin") {
      companyId = req.user.company_id;
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId required",
      });
    }

    const devices = await Device.find({
      company_id: companyId,
      status: "active",
    });

    const io = socketInstance.getIO();
    const playedDevices = [];
    const sharedEpoch = Date.now();

    for (const d of devices) {
      const ads = await findAdsForDevice(d.deviceId, { companyId });
      if (!ads.length) continue;

      const isPaused = activeScreens.get(d.deviceId)?.currentVideo === "PAUSED";
      const clock = isPaused
        ? activeScreens.resumePlaybackClock(d.deviceId) ||
          activeScreens.startPlaybackClock(d.deviceId, {
            ads,
            companyId,
            locationId: d.location_id?.[0] || null,
            startedBy: "manual",
            anchorEpochMs: sharedEpoch,
            inheritLocationPeer: false,
          })
        : activeScreens.startPlaybackClock(d.deviceId, {
            ads,
            companyId,
            locationId: d.location_id?.[0] || null,
            startedBy: "manual",
            anchorEpochMs: sharedEpoch,
            inheritLocationPeer: false,
          });

      persistDevicePlayback(d.deviceId, {
        status: "playing",
        ads,
        currentVideo: clock.currentVideo || ads[0]?.videoPath || null,
        currentTime: clock.currentTime || 0,
        startedBy: "manual",
      });

      io.to(`device_${d.deviceId}`).emit("play_ads", {
        companyId,
        deviceId: d.deviceId,
        ads,
        resume: isPaused,
        resumeTime: clock.currentTime,
        startIndex: clock.adIndex,
        serverNow: Date.now(),
      });

      playedDevices.push(d.deviceId);
    }

    activeScreens.broadcastLiveScreens(io);

    res.json({ success: true, playedDevices });
  } catch (error) {
    console.error("Play By Company Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =======================================================
   ⏸️ BULK PAUSE / ⛔ BULK STOP
======================================================= */
exports.pauseBulk = async (req, res) => {
  try {
    let { companyId, locationId } = req.body || {};
    if (req.user?.role === "company_admin") {
      companyId = req.user.company_id;
    }

    if (!companyId && !locationId) {
      return res.status(400).json({
        success: false,
        message: "companyId or locationId required",
      });
    }

    const query = {
      status: "active",
      ...(companyId ? { company_id: companyId } : {}),
      ...(locationId ? { location_id: locationId } : {}),
    };

    const devices = await Device.find(query);
    const io = socketInstance.getIO();

    devices.forEach((d) => {
      io.to(`device_${d.deviceId}`).emit("pause_ads", {
        companyId: d.company_id,
        deviceId: d.deviceId,
      });
      const pausedState = activeScreens.pausePlaybackClock(d.deviceId);
      persistDevicePlayback(d.deviceId, {
        status: "paused",
        currentVideo: "PAUSED",
        currentTime: pausedState?.currentTime ?? 0,
      });
    });

    activeScreens.broadcastLiveScreens(io);

    res.json({
      success: true,
      affectedDevices: devices.map((d) => d.deviceId),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.stopBulk = async (req, res) => {
  try {
    let { companyId, locationId } = req.body || {};
    if (req.user?.role === "company_admin") {
      companyId = req.user.company_id;
    }

    if (!companyId && !locationId) {
      return res.status(400).json({
        success: false,
        message: "companyId or locationId required",
      });
    }

    const query = {
      status: "active",
      ...(companyId ? { company_id: companyId } : {}),
      ...(locationId ? { location_id: locationId } : {}),
    };

    const devices = await Device.find(query);
    const io = socketInstance.getIO();

    devices.forEach((d) => {
      adScheduler.markManualStop(d.deviceId);
      io.to(`device_${d.deviceId}`).emit("stop_ads", {
        companyId: d.company_id,
        deviceId: d.deviceId,
      });
      activeScreens.updateVideo(d.deviceId, null);
      activeScreens.setPlaybackState(d.deviceId, {
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
      persistDevicePlayback(d.deviceId, {
        status: "stopped",
        ads: [],
        currentVideo: null,
        currentTime: 0,
        startedBy: null,
      });
    });

    activeScreens.broadcastLiveScreens(io);

    res.json({
      success: true,
      affectedDevices: devices.map((d) => d.deviceId),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =======================================================
   🚨 EMERGENCY ANNOUNCEMENT OVERRIDE
======================================================= */
exports.emergencyOverride = async (req, res) => {
  try {
    let {
      companyId,
      locationId,
      deviceIds,
      title,
      message,
      backgroundColor,
      durationSeconds,
      active = true,
    } = req.body || {};

    const scopedCompanyId =
      req.user?.role === "company_admin" ? req.user.company_id : companyId;

    if (active !== false && (!message || !String(message).trim())) {
      return res.status(400).json({
        success: false,
        message: "Announcement message is required",
      });
    }

    const query = {
      status: "active",
      ...(scopedCompanyId ? { company_id: scopedCompanyId } : {}),
      ...(locationId ? { location_id: locationId } : {}),
      ...(Array.isArray(deviceIds) && deviceIds.length > 0
        ? { deviceId: { $in: deviceIds } }
        : {}),
    };

    const devices = await Device.find(query);
    const io = socketInstance.getIO();

    if (active === false) {
      devices.forEach((d) => {
        activeScreens.clearEmergencyOverride(d.deviceId);
        io.to(`device_${d.deviceId}`).emit("emergency_override", {
          active: false,
        });
      });

      return res.json({
        success: true,
        message: "Emergency alert cleared",
        affectedDevices: devices.map((d) => d.deviceId),
      });
    }

    const dur = Number(durationSeconds) || 0;
    const expiresAt = dur > 0 ? new Date(Date.now() + dur * 1000) : null;
    const alertPayload = {
      active: true,
      title: String(title || "URGENT ANNOUNCEMENT").trim(),
      message: String(message).trim(),
      backgroundColor: backgroundColor || "#dc2626",
      durationSeconds: dur,
      expiresAt,
    };

    devices.forEach((d) => {
      activeScreens.setEmergencyOverride(d.deviceId, alertPayload);
      io.to(`device_${d.deviceId}`).emit("emergency_override", alertPayload);
    });

    res.json({
      success: true,
      message: "Emergency alert broadcasted",
      affectedDevices: devices.map((d) => d.deviceId),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =======================================================
   ✅ STOP ADS (SINGLE DEVICE)
======================================================= */
exports.stopAdvertisements = async (req, res) => {
  const { companyId, deviceId } = req.body;
  if (!deviceId) {
    return res.status(400).json({
      success: false,
      message: "deviceId required",
    });
  }

  const deviceDoc = await Device.findOne({ deviceId });
  if (
    req.user?.role === "company_admin" &&
    deviceDoc &&
    String(deviceDoc.company_id) !== String(req.user.company_id || "")
  ) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const io = socketInstance.getIO();
  adScheduler.markManualStop(deviceId);

  io.to(`device_${deviceId}`).emit("stop_ads", {
    companyId,
    deviceId,
  });

  activeScreens.updateVideo(deviceId, null);
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

  persistDevicePlayback(deviceId, {
    status: "stopped",
    ads: [],
    currentVideo: null,
    currentTime: 0,
    startedBy: null,
  });

  activeScreens.broadcastLiveScreens(io);

  res.json({
    success: true,
    message: `Stopped for device ${deviceId}`,
  });
};

/* =======================================================
   ✅ PAUSE ADS (SINGLE DEVICE)
======================================================= */
exports.pauseAdvertisements = async (req, res) => {
  try {
    const { companyId, deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId required",
      });
    }

    const deviceDoc = await Device.findOne({ deviceId });
    if (
      req.user?.role === "company_admin" &&
      deviceDoc &&
      String(deviceDoc.company_id) !== String(req.user.company_id || "")
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const io = socketInstance.getIO();

    io.to(`device_${deviceId}`).emit("pause_ads", {
      companyId,
      deviceId,
    });

    const pausedState = activeScreens.pausePlaybackClock(deviceId);

    persistDevicePlayback(deviceId, {
      status: "paused",
      currentVideo: "PAUSED",
      currentTime: pausedState?.currentTime ?? 0,
    });

    activeScreens.broadcastLiveScreens(io);

    res.json({
      success: true,
      message: `Paused for device ${deviceId}`,
    });
  } catch (error) {
    console.error("Pause error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
