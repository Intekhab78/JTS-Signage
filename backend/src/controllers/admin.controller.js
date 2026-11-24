const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Company = require("../models/Company");
const Location = require("../models/Location");
const Advertisement = require("../models/Advertisement");
const Device = require("../models/Device");
const activeScreens = require("../activeScreens");

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createUniqueCompany = async ({
  name,
  email = "",
  industry = "",
  phone = "",
  createdBy = null,
}) => {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    const err = new Error("Company name is required");
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await Company.findOne({
    isActive: true,
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
  });
  if (duplicate) {
    const err = new Error(
      "A company with this name already exists — select it from the dropdown instead"
    );
    err.statusCode = 400;
    throw err;
  }

  return Company.create({
    name: trimmedName,
    ...(email ? { email: String(email).trim().toLowerCase() } : {}),
    ...(industry ? { industry: String(industry).trim() } : {}),
    ...(phone ? { phone: String(phone).trim() } : {}),
    ...(createdBy ? { createdBy } : {}),
    isActive: true,
  });
};

const resolveCompanyAssignment = async ({
  body = {},
  fallbackEmail = "",
  adminUserId = null,
}) => {
  const trimmedNewName = String(body.newCompanyName || "").trim();
  if (trimmedNewName && !body.company_id) {
    const createdCompany = await createUniqueCompany({
      name: trimmedNewName,
      email: fallbackEmail,
      industry: body.companyIndustry,
      phone: body.companyPhone,
      createdBy: adminUserId,
    });
    return { companyId: createdCompany._id, createdCompany };
  }

  if (!body.company_id) {
    const err = new Error(
      "Select an existing company or enter a new company name for Company Admin"
    );
    err.statusCode = 400;
    throw err;
  }

  const existing = await Company.findOne({
    _id: body.company_id,
    isActive: true,
  });
  if (!existing) {
    const err = new Error("Selected company not found");
    err.statusCode = 404;
    throw err;
  }

  return { companyId: existing._id, createdCompany: null };
};

const buildOfflineAlerts = async (companyId = null) => {
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
  const query = {
    status: "active",
    isOnline: false,
    ...(companyId ? { company_id: companyId } : {}),
    $or: [
      { lastSeen: { $lt: fiveMinsAgo } },
      { lastSeen: null, createdAt: { $lt: fiveMinsAgo } },
    ],
  };

  const devices = await Device.find(query)
    .populate("company_id", "name")
    .sort({ lastSeen: 1 });

  return devices.map((d) => {
    const referenceTime = d.lastSeen || d.createdAt;
    const offlineMinutes = Math.max(
      5,
      Math.floor((Date.now() - new Date(referenceTime).getTime()) / 60000)
    );
    return {
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      companyName: d.company_id?.name || "Unknown Company",
      lastSeen: d.lastSeen || null,
      offlineMinutes,
    };
  });
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("company_id", "name")
      .sort({ name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Super Admin account is locked and cannot be modified",
      });
    }

    const requestedRole = req.body?.role;
    if (!["company_admin", "customer"].includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: "Role must be 'company_admin' or 'customer' (No Access / Pending)",
      });
    }

    let createdCompany = null;
    if (requestedRole === "company_admin") {
      const assigned = await resolveCompanyAssignment({
        body: req.body,
        fallbackEmail: user.email,
        adminUserId: req.user?.id,
      });
      user.company_id = assigned.companyId;
      user.requestedCompanyName = "";
      createdCompany = assigned.createdCompany;
    } else {
      user.company_id = null;
    }

    user.role = requestedRole;
    await user.save();

    const populated = await User.findById(user._id)
      .select("-password")
      .populate("company_id", "name");

    res.json({ success: true, data: populated, createdCompany });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

exports.createClientUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const targetRole = role === "customer" ? "customer" : "company_admin";
    let companyId = null;
    let createdCompany = null;

    if (targetRole === "company_admin") {
      const assigned = await resolveCompanyAssignment({
        body: req.body,
        fallbackEmail: normalizedEmail,
        adminUserId: req.user?.id,
      });
      companyId = assigned.companyId;
      createdCompany = assigned.createdCompany;
    }

    const hash = await bcrypt.hash(String(password), 10);
    const createdUser = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hash,
      role: targetRole,
      company_id: companyId,
      requestedCompanyName: "",
    });

    const populated = await User.findById(createdUser._id)
      .select("-password")
      .populate("company_id", "name");

    res.status(201).json({
      success: true,
      message: createdCompany
        ? `Client "${populated.name}" and company "${createdCompany.name}" created successfully`
        : `Client "${populated.name}" created successfully`,
      data: populated,
      createdCompany,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

/**
 * @desc    Admin / Company Admin Dashboard Stats + Offline Health Alerts
 * @route   GET /api/admin/dashboard
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const isCompanyAdmin = req.user?.role === "company_admin";
    const companyId = isCompanyAdmin ? req.user.company_id : null;

    if (isCompanyAdmin && !companyId) {
      return res.status(403).json({
        success: false,
        message: "Company admin account has no assigned company",
      });
    }

    const companyQuery = companyId
      ? { _id: companyId, isActive: true }
      : { isActive: true };
    const locationQuery = companyId
      ? { company_id: companyId, isActive: true }
      : { isActive: true };
    const adAllQuery = companyId ? { company_ids: companyId } : {};
    const adActiveQuery = companyId
      ? { company_ids: companyId, isActive: true }
      : { isActive: true };

    const [
      companyCount,
      locationCount,
      adCount,
      activeAdCount,
      offlineAlerts,
    ] = await Promise.all([
      Company.countDocuments(companyQuery),
      Location.countDocuments(locationQuery),
      Advertisement.countDocuments(adAllQuery),
      Advertisement.countDocuments(adActiveQuery),
      buildOfflineAlerts(companyId),
    ]);

    const allScreens = activeScreens.list();
    const scopedScreens = companyId
      ? allScreens.filter((s) => s.companyId === String(companyId))
      : allScreens;

    res.status(200).json({
      success: true,
      data: {
        companies: companyCount,
        locations: locationCount,
        advertisements: adCount,
        activeAdvertisements: activeAdCount,
        activeScreens: scopedScreens.length,
        offlineAlerts,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get all live screens (tenant-scoped for company_admin)
 * @route   GET /api/admin/live-screens
 */
exports.getLiveScreens = async (req, res) => {
  try {
    const isCompanyAdmin = req.user?.role === "company_admin";
    const companyId = isCompanyAdmin ? String(req.user.company_id || "") : null;

    let screens = activeScreens.list();
    if (isCompanyAdmin) {
      screens = screens.filter((s) => s.companyId === companyId);
    }

    const formattedScreens = screens.map((s) => ({
      deviceId: s.deviceId,
      companyId: s.companyId,
      locationId: s.locationId,
      locationName: s.locationName || "Unknown Location",
      companyName: s.companyName || "Unknown Company",
      currentVideo: s.currentVideo,
      currentTime: s.currentTime,
      socketId: s.socketId,
      connectedAt: s.connectedAt,
      playbackStatus: s.playbackStatus,
    }));

    res.status(200).json({
      success: true,
      data: formattedScreens,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get offline device health alerts (> 5 min offline)
 * @route   GET /api/admin/alerts
 */
exports.getOfflineAlerts = async (req, res) => {
  try {
    const isCompanyAdmin = req.user?.role === "company_admin";
    const companyId = isCompanyAdmin ? req.user.company_id : null;
    const alerts = await buildOfflineAlerts(companyId);
    res.status(200).json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
