const mongoose = require("mongoose");
const PlayLog = require("../models/PlayLog");
const playLogStore = require("../utils/playLogStore");

const extractRawAnalyticsFilters = (req) => {
  const { companyId, locationId, deviceId, startDate, endDate } =
    req.query || {};
  const effectiveCompanyId =
    req.user?.role === "company_admin" ? req.user.company_id : companyId;

  return {
    companyId: effectiveCompanyId || undefined,
    locationId: locationId || undefined,
    deviceId: deviceId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };
};

const buildAnalyticsFilter = (req) => {
  const { companyId, locationId, deviceId, startDate, endDate } =
    req.query || {};
  const filter = {};

  const effectiveCompanyId =
    req.user?.role === "company_admin" ? req.user.company_id : companyId;

  if (effectiveCompanyId && mongoose.Types.ObjectId.isValid(String(effectiveCompanyId))) {
    filter.company_id = new mongoose.Types.ObjectId(String(effectiveCompanyId));
  }

  if (locationId && mongoose.Types.ObjectId.isValid(String(locationId))) {
    filter.location_id = new mongoose.Types.ObjectId(String(locationId));
  }

  if (deviceId && String(deviceId).trim()) {
    filter.deviceId = String(deviceId).trim();
  }

  if (startDate || endDate) {
    filter.startedAt = {};
    if (startDate) {
      filter.startedAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      filter.startedAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
  }

  return filter;
};

exports.getAnalyticsSummary = async (req, res) => {
  try {
    const rawFilters = extractRawAnalyticsFilters(req);

    if (playLogStore.isUsingLocalFallback()) {
      return res.status(200).json({
        success: true,
        data: playLogStore.summarizeLocalLogs(rawFilters),
      });
    }

    const filter = buildAnalyticsFilter(req);

    const [totalsAgg, topAds, byDevice, recentLogs] = await Promise.all([
      PlayLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalPlays: { $sum: 1 },
            totalDurationSeconds: { $sum: "$durationSeconds" },
            devices: { $addToSet: "$deviceId" },
            ads: { $addToSet: "$adTitle" },
          },
        },
      ]),
      PlayLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              advertisement_id: "$advertisement_id",
              adTitle: "$adTitle",
              mediaType: "$mediaType",
            },
            plays: { $sum: 1 },
            totalDurationSeconds: { $sum: "$durationSeconds" },
          },
        },
        { $sort: { plays: -1 } },
        { $limit: 10 },
      ]),
      PlayLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { deviceId: "$deviceId", deviceName: "$deviceName" },
            plays: { $sum: 1 },
            totalDurationSeconds: { $sum: "$durationSeconds" },
          },
        },
        { $sort: { plays: -1 } },
        { $limit: 20 },
      ]),
      PlayLog.find(filter)
        .populate("company_id", "name")
        .populate("location_id", "name")
        .sort({ startedAt: -1 })
        .limit(50),
    ]);

    const totals = totalsAgg[0] || {
      totalPlays: 0,
      totalDurationSeconds: 0,
      devices: [],
      ads: [],
    };

    if ((totals.totalPlays || 0) === 0 && playLogStore.hasLocalLogs()) {
      return res.status(200).json({
        success: true,
        data: playLogStore.summarizeLocalLogs(rawFilters),
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalPlays: totals.totalPlays || 0,
        totalDurationSeconds: totals.totalDurationSeconds || 0,
        uniqueDevices: (totals.devices || []).length,
        uniqueAds: (totals.ads || []).length,
        topAds: topAds.map((a) => ({
          advertisementId: a._id.advertisement_id,
          adTitle: a._id.adTitle || "Untitled Ad",
          mediaType: a._id.mediaType || "video",
          plays: a.plays,
          totalDurationSeconds: a.totalDurationSeconds,
        })),
        byDevice: byDevice.map((d) => ({
          deviceId: d._id.deviceId,
          deviceName: d._id.deviceName || d._id.deviceId,
          plays: d.plays,
          totalDurationSeconds: d.totalDurationSeconds,
        })),
        recentLogs,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const csvEscape = (value) => {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

exports.exportAnalyticsCsv = async (req, res) => {
  try {
    const rawFilters = extractRawAnalyticsFilters(req);
    let logs;

    if (playLogStore.isUsingLocalFallback()) {
      logs = playLogStore.queryLocalLogs(rawFilters);
    } else {
      const filter = buildAnalyticsFilter(req);
      logs = await PlayLog.find(filter)
        .populate("company_id", "name")
        .populate("location_id", "name")
        .sort({ startedAt: -1 })
        .limit(5000);

      if (logs.length === 0 && playLogStore.hasLocalLogs()) {
        logs = playLogStore.queryLocalLogs(rawFilters);
      }
    }

    const header =
      "Date,Ad Title,Media Type,Device ID,Device Name,Company,Location,Duration (sec)";
    const rows = logs.map((log) =>
      [
        log.startedAt ? new Date(log.startedAt).toISOString() : "",
        log.adTitle || "Untitled Ad",
        log.mediaType || "video",
        log.deviceId,
        log.deviceName || "",
        log.company_id?.name || "",
        log.location_id?.name || "",
        log.durationSeconds ?? 0,
      ]
        .map(csvEscape)
        .join(",")
    );

    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="proof-of-play.csv"'
    );
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
