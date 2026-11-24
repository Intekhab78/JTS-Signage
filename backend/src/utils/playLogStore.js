const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PlayLog = require("../models/PlayLog");

const DATA_DIR = path.join(__dirname, "../../data");
const getStoreFile = () =>
  process.env.PLAYLOG_STORE_PATH
    ? path.resolve(process.env.PLAYLOG_STORE_PATH)
    : path.join(DATA_DIR, "playlogs.json");

const MAX_LOCAL_LOGS = 5000;

let atlasCollectionLimitHit = false;
let warnLogged = false;
let localLogs = [];
let loadedFromPath = null;
let writeQueue = Promise.resolve();

const ensureLoaded = () => {
  const storeFile = getStoreFile();
  if (loadedFromPath === storeFile) return;
  loadedFromPath = storeFile;
  try {
    if (fs.existsSync(storeFile)) {
      const raw = fs.readFileSync(storeFile, "utf8");
      const parsed = JSON.parse(raw);
      localLogs = Array.isArray(parsed) ? parsed.slice(0, MAX_LOCAL_LOGS) : [];
    } else {
      localLogs = [];
    }
  } catch (err) {
    console.warn("Failed to read local playlogs store:", err.message);
    localLogs = [];
  }
};

ensureLoaded();

const isAtlasCollectionLimitError = (err) => {
  const msg = String(err?.message || "");
  return /cannot create a new collection|500 collections/i.test(msg);
};

const persistLogs = () => {
  const storeFile = getStoreFile();
  const snapshot = JSON.stringify(localLogs);
  writeQueue = writeQueue
    .then(async () => {
      await fs.promises.mkdir(path.dirname(storeFile), { recursive: true });
      const tmpFile = `${storeFile}.tmp`;
      await fs.promises.writeFile(tmpFile, snapshot, "utf8");
      await fs.promises.rename(tmpFile, storeFile);
    })
    .catch((err) => {
      console.error("Local PlayLog persist error:", err.message);
    });
  return writeQueue;
};

const normalizeLocalEntry = (entry = {}) => {
  const startedAtDate = entry.startedAt ? new Date(entry.startedAt) : new Date();
  const endedAtDate = entry.endedAt ? new Date(entry.endedAt) : new Date();
  const companyIdStr = entry.companyId ? String(entry.companyId) : null;
  const locationIdStr = entry.locationId ? String(entry.locationId) : null;

  return {
    _id: crypto.randomUUID(),
    advertisement_id: entry.advertisementId
      ? String(entry.advertisementId)
      : undefined,
    adTitle: entry.adTitle || "Untitled Ad",
    mediaType: entry.mediaType === "image" ? "image" : "video",
    deviceId: String(entry.deviceId || ""),
    deviceName: entry.deviceName || "",
    company_id: companyIdStr
      ? { _id: companyIdStr, name: entry.companyName || "" }
      : null,
    location_id: locationIdStr
      ? { _id: locationIdStr, name: entry.locationName || "" }
      : null,
    startedAt: Number.isNaN(startedAtDate.getTime())
      ? new Date().toISOString()
      : startedAtDate.toISOString(),
    endedAt: Number.isNaN(endedAtDate.getTime())
      ? new Date().toISOString()
      : endedAtDate.toISOString(),
    durationSeconds: Math.max(
      0,
      Math.round(Number(entry.durationSeconds) || 0)
    ),
  };
};

const saveLocally = async (entry) => {
  ensureLoaded();
  const logDoc = normalizeLocalEntry(entry);
  localLogs.unshift(logDoc);
  if (localLogs.length > MAX_LOCAL_LOGS) {
    localLogs.length = MAX_LOCAL_LOGS;
  }
  await persistLogs();
  return logDoc;
};

const isUsingLocalFallback = () => atlasCollectionLimitHit;

const hasLocalLogs = () => {
  ensureLoaded();
  return localLogs.length > 0;
};

const recordPlayLog = async (entry = {}) => {
  if (!atlasCollectionLimitHit) {
    try {
      const doc = await PlayLog.create({
        advertisement_id: entry.advertisementId || undefined,
        adTitle: entry.adTitle || "Untitled Ad",
        mediaType: entry.mediaType === "image" ? "image" : "video",
        deviceId: entry.deviceId,
        deviceName: entry.deviceName || "",
        company_id: entry.companyId || undefined,
        location_id: entry.locationId || undefined,
        startedAt: entry.startedAt ? new Date(entry.startedAt) : new Date(),
        endedAt: entry.endedAt ? new Date(entry.endedAt) : new Date(),
        durationSeconds: Math.max(
          0,
          Math.round(Number(entry.durationSeconds) || 0)
        ),
      });
      return { storage: "mongodb", doc };
    } catch (err) {
      if (!isAtlasCollectionLimitError(err)) {
        throw err;
      }
      atlasCollectionLimitHit = true;
      if (!warnLogged) {
        warnLogged = true;
        console.warn(
          "MongoDB Atlas 500-collection limit reached for PlayLog. Switching Proof-of-Play logs to local JSON fallback:",
          getStoreFile()
        );
      }
    }
  }

  const doc = await saveLocally(entry);
  return { storage: "local", doc };
};

const queryLocalLogs = ({
  companyId,
  locationId,
  deviceId,
  startDate,
  endDate,
} = {}) => {
  ensureLoaded();

  const companyTarget = companyId ? String(companyId) : null;
  const locationTarget = locationId ? String(locationId) : null;
  const deviceTarget = deviceId ? String(deviceId).trim() : null;

  const startMs = startDate ? new Date(startDate).getTime() : NaN;
  const endMs = endDate ? new Date(endDate).getTime() : NaN;

  return localLogs
    .filter((log) => {
      if (companyTarget) {
        const logCompany = log.company_id?._id || log.company_id || "";
        if (String(logCompany) !== companyTarget) return false;
      }
      if (locationTarget) {
        const logLocation = log.location_id?._id || log.location_id || "";
        if (String(logLocation) !== locationTarget) return false;
      }
      if (deviceTarget && String(log.deviceId || "") !== deviceTarget) {
        return false;
      }
      const startedMs = new Date(log.startedAt).getTime();
      if (!Number.isNaN(startMs) && startedMs < startMs) return false;
      if (!Number.isNaN(endMs) && startedMs > endMs) return false;
      return true;
    })
    .slice()
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
    .slice(0, MAX_LOCAL_LOGS);
};

const summarizeLocalLogs = (filters = {}) => {
  const matching = queryLocalLogs(filters);

  let totalDurationSeconds = 0;
  const uniqueDeviceSet = new Set();
  const uniqueAdSet = new Set();
  const adMap = new Map();
  const deviceMap = new Map();

  for (const log of matching) {
    const dur = Number(log.durationSeconds) || 0;
    totalDurationSeconds += dur;

    if (log.deviceId) {
      uniqueDeviceSet.add(log.deviceId);
    }

    const adKey = `${log.advertisement_id || ""}::${log.adTitle || "Untitled Ad"}::${log.mediaType || "video"}`;
    uniqueAdSet.add(log.advertisement_id || adKey);

    const existingAd = adMap.get(adKey) || {
      advertisementId: log.advertisement_id,
      adTitle: log.adTitle || "Untitled Ad",
      mediaType: log.mediaType || "video",
      plays: 0,
      totalDurationSeconds: 0,
    };
    existingAd.plays += 1;
    existingAd.totalDurationSeconds += dur;
    adMap.set(adKey, existingAd);

    if (log.deviceId) {
      const existingDevice = deviceMap.get(log.deviceId) || {
        deviceId: log.deviceId,
        deviceName: log.deviceName || log.deviceId,
        plays: 0,
        totalDurationSeconds: 0,
      };
      if (log.deviceName) {
        existingDevice.deviceName = log.deviceName;
      }
      existingDevice.plays += 1;
      existingDevice.totalDurationSeconds += dur;
      deviceMap.set(log.deviceId, existingDevice);
    }
  }

  const topAds = Array.from(adMap.values())
    .sort(
      (a, b) =>
        b.plays - a.plays || b.totalDurationSeconds - a.totalDurationSeconds
    )
    .slice(0, 10);

  const byDevice = Array.from(deviceMap.values())
    .sort(
      (a, b) =>
        b.plays - a.plays || b.totalDurationSeconds - a.totalDurationSeconds
    )
    .slice(0, 20);

  return {
    totalPlays: matching.length,
    totalDurationSeconds,
    uniqueDevices: uniqueDeviceSet.size,
    uniqueAds: uniqueAdSet.size,
    topAds,
    byDevice,
    recentLogs: matching.slice(0, 50),
  };
};

module.exports = {
  isUsingLocalFallback,
  hasLocalLogs,
  recordPlayLog,
  queryLocalLogs,
  summarizeLocalLogs,
};
