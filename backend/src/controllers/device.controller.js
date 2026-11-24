const crypto = require("crypto");
const Device = require("../models/Device");
const pairingStore = require("../utils/pairingStore");
const socketInstance = require("../socketInstance");

const generateToken = () => crypto.randomBytes(6).toString("hex");
const generatePairingCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const checkTenantAccess = (req, companyId) => {
  if (req.user?.role !== "company_admin") return true;
  return String(companyId || "") === String(req.user.company_id || "");
};

/* =======================================================
   📺 PUBLIC PAIRING CODE REQUEST (FOR TV SCREEN)
======================================================= */
exports.requestPairingCode = async (req, res) => {
  try {
    let code = generatePairingCode();
    for (let i = 0; i < 5; i++) {
      if (!pairingStore.hasCode(code)) break;
      code = generatePairingCode();
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    pairingStore.createSession({ code, expiresAt });

    res.status(201).json({
      success: true,
      code,
      expiresAt,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =======================================================
   ✅ COMPLETE PAIRING (ADMIN / COMPANY ADMIN)
======================================================= */
exports.completePairing = async (req, res) => {
  try {
    let { code, deviceId, deviceName, company_id, location_id } = req.body;

    if (req.user?.role === "company_admin") {
      company_id = req.user.company_id;
    }

    if (!code || !deviceId || !deviceName || !company_id) {
      return res.status(400).json({
        success: false,
        message: "code, deviceId, deviceName, and company_id are required",
      });
    }

    const trimmedCode = String(code).trim();
    const session = pairingStore.getPendingSession(trimmedCode);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired pairing code",
      });
    }

    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: "Device ID already exists",
      });
    }

    const locations = Array.isArray(location_id)
      ? location_id
      : location_id
        ? [location_id]
        : [];

    const device = await Device.create({
      deviceId: String(deviceId).trim(),
      deviceName: String(deviceName).trim(),
      company_id,
      location_id: locations,
      status: "active",
      screenToken: generateToken(),
    });

    pairingStore.markPaired(trimmedCode, {
      pairedDeviceId: device.deviceId,
      screenToken: device.screenToken,
    });

    try {
      const io = socketInstance.getIO();
      io.to(`pair_${trimmedCode}`).emit("device_paired", {
        screenToken: device.screenToken,
        deviceId: device.deviceId,
      });
    } catch {
      // Socket.io not initialized during standalone tests
    }

    res.status(201).json({
      success: true,
      message: "TV paired successfully",
      data: device,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =======================================================
   ✅ CREATE DEVICE (WITH SHORT SCREEN TOKEN)
======================================================= */
exports.createDevice = async (req, res) => {
  try {
    let { deviceId, deviceName, company_id, location_id, status } = req.body;

    if (req.user?.role === "company_admin") {
      company_id = req.user.company_id;
    }

    const exists = await Device.findOne({ deviceId });
    if (exists) {
      return res.status(400).json({ message: "Device already exists" });
    }

    const locations = Array.isArray(location_id)
      ? location_id
      : location_id
        ? [location_id]
        : [];

    const device = await Device.create({
      deviceId,
      deviceName,
      company_id,
      location_id: locations,
      status,
      screenToken: generateToken(),
    });

    res.status(201).json({
      message: "Device created successfully",
      data: device,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================================================
   ✅ GET ALL DEVICES
======================================================= */
exports.getAllDevices = async (req, res) => {
  try {
    const query =
      req.user?.role === "company_admin"
        ? { company_id: req.user.company_id }
        : {};

    const devices = await Device.find(query)
      .populate("company_id", "name")
      .populate("location_id", "name");

    res.json({ data: devices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================================================
   ✅ GET SINGLE DEVICE
======================================================= */
exports.getDeviceById = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id)
      .populate("company_id", "name")
      .populate("location_id", "name");

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (!checkTenantAccess(req, device.company_id?._id || device.company_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ data: device });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================================================
   ✅ GET DEVICE BY TOKEN (SHORT URL SUPPORT)
======================================================= */
exports.getDeviceByToken = async (req, res) => {
  try {
    const device = await Device.findOne({
      screenToken: req.params.token,
    })
      .populate("company_id", "name")
      .populate("location_id", "name");

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json({ data: device });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================================================
   ✅ UPDATE DEVICE
======================================================= */
exports.updateDevice = async (req, res) => {
  try {
    const existingDevice = await Device.findById(req.params.id);
    if (!existingDevice) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (!checkTenantAccess(req, existingDevice.company_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user?.role === "company_admin") {
      req.body.company_id = req.user.company_id;
    }

    const { deviceId, location_id } = req.body;

    if (deviceId) {
      const exists = await Device.findOne({
        deviceId,
        _id: { $ne: req.params.id },
      });

      if (exists) {
        return res.status(400).json({ message: "Device ID already in use" });
      }
    }

    if (location_id) {
      req.body.location_id = Array.isArray(location_id)
        ? location_id
        : [location_id];
    }

    const device = await Device.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      message: "Device updated successfully",
      data: device,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================================================
   ⚙️ UPDATE REMOTE SCREEN SETTINGS
======================================================= */
exports.updateDeviceSettings = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (!checkTenantAccess(req, device.company_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { volume, muted, orientation } = req.body || {};
    const nextVolume =
      volume !== undefined ? Number(volume) : device.settings?.volume ?? 100;
    const nextMuted =
      muted !== undefined ? Boolean(muted) : device.settings?.muted ?? false;
    const nextOrientation =
      orientation !== undefined
        ? String(orientation)
        : device.settings?.orientation ?? "0";

    if (!Number.isFinite(nextVolume) || nextVolume < 0 || nextVolume > 100) {
      return res
        .status(400)
        .json({ message: "Volume must be between 0 and 100" });
    }

    if (!["0", "90", "180", "270"].includes(nextOrientation)) {
      return res
        .status(400)
        .json({ message: "Orientation must be 0, 90, 180, or 270" });
    }

    device.settings = {
      volume: nextVolume,
      muted: nextMuted,
      orientation: nextOrientation,
    };
    await device.save();

    try {
      const io = socketInstance.getIO();
      io.to(`device_${device.deviceId}`).emit(
        "screen_settings_update",
        device.settings
      );
    } catch {
      // Socket.io not initialized during standalone tests
    }

    res.json({
      success: true,
      message: "Screen settings updated",
      data: device,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================================================
   🔄 SEND REMOTE DEVICE COMMAND (RELOAD / CLEAR_CACHE)
======================================================= */
exports.sendDeviceCommand = async (req, res) => {
  try {
    const { command } = req.body || {};
    if (!["reload", "clear_cache"].includes(command)) {
      return res.status(400).json({
        success: false,
        message: "Command must be 'reload' or 'clear_cache'",
      });
    }

    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (!checkTenantAccess(req, device.company_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const io = socketInstance.getIO();
      io.to(`device_${device.deviceId}`).emit("device_command", {
        command,
        deviceId: device.deviceId,
      });
    } catch {
      // Socket.io not initialized during standalone tests
    }

    res.json({
      success: true,
      message: `Command '${command}' sent to ${device.deviceId}`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================================================
   ✅ DELETE DEVICE
======================================================= */
exports.deleteDevice = async (req, res) => {
  try {
    const existing = await Device.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (!checkTenantAccess(req, existing.company_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Device.findByIdAndDelete(req.params.id);

    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================================================
   ✅ CHECK DEVICE BY DEVICE ID
======================================================= */
exports.checkDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });

    if (device && !checkTenantAccess(req, device.company_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({
      found: !!device,
      device,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerDevice = async (req, res) => {
  try {
    let { deviceId, deviceName, company_id, location_id } = req.body;

    if (req.user?.role === "company_admin") {
      company_id = req.user.company_id;
    }

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId required" });
    }

    const locations = Array.isArray(location_id)
      ? location_id
      : location_id
        ? [location_id]
        : [];

    let device = await Device.findOne({ deviceId });

    if (!device) {
      device = await Device.create({
        deviceId,
        deviceName,
        company_id,
        location_id: locations,
        screenToken: generateToken(),
      });
    } else {
      if (!checkTenantAccess(req, device.company_id)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!device.deviceName && deviceName) {
        device.deviceName = deviceName;
      }
      if (locations.length) {
        device.location_id = locations;
      }
      await device.save();
    }

    res.json({ success: true, device });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
