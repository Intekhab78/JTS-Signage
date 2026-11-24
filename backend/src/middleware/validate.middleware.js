const fs = require("fs");
const mongoose = require("mongoose");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const ALLOWED_ROLES = ["customer", "agent", "company_admin", "admin"];
const ALLOWED_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const isValidObjectId = (val) =>
  typeof val === "string" &&
  /^[0-9a-fA-F]{24}$/.test(val) &&
  mongoose.Types.ObjectId.isValid(val);

const parseArrayField = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const cleanupUploadedFile = (req) => {
  if (req.file?.path) {
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (err) {
      console.error("Failed to cleanup invalid upload:", err.message);
    }
  }
};

const sendValidationError = (req, res, errors) => {
  cleanupUploadedFile(req);
  return res.status(400).json({
    success: false,
    message: errors[0],
    errors,
  });
};

exports.validateObjectIdParam =
  (paramName = "id") =>
  (req, res, next) => {
    const val = req.params?.[paramName];
    if (!isValidObjectId(val)) {
      return sendValidationError(req, res, [`Invalid ${paramName}`]);
    }
    next();
  };

exports.validateAuthRegister = (req, res, next) => {
  const errors = [];
  const { name, email, password, role } = req.body || {};

  if (!name || !String(name).trim()) {
    errors.push("Name is required");
  }
  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    errors.push("Valid email is required");
  }
  if (!password || String(password).length < 6) {
    errors.push("Password must be at least 6 characters");
  }
  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    errors.push("Invalid role");
  }

  if (errors.length) return sendValidationError(req, res, errors);
  next();
};

exports.validateAuthLogin = (req, res, next) => {
  const errors = [];
  const { email, password } = req.body || {};

  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    errors.push("Valid email is required");
  }
  if (!password || !String(password)) {
    errors.push("Password is required");
  }

  if (errors.length) return sendValidationError(req, res, errors);
  next();
};

exports.validateForgotPassword = (req, res, next) => {
  const { email } = req.body || {};
  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    return sendValidationError(req, res, ["Valid email is required"]);
  }
  next();
};

const makeCompanyValidator = (isUpdate) => (req, res, next) => {
  const errors = [];
  const { name, email, foundedYear } = req.body || {};

  if (!isUpdate) {
    if (!name || !String(name).trim()) {
      errors.push("Company name is required");
    }
  } else if (name !== undefined && !String(name).trim()) {
    errors.push("Company name cannot be empty");
  }

  if (email !== undefined && String(email).trim() !== "") {
    if (!EMAIL_REGEX.test(String(email).trim())) {
      errors.push("Invalid email address");
    }
  }

  if (foundedYear !== undefined && String(foundedYear).trim() !== "") {
    const year = Number(foundedYear);
    if (!Number.isInteger(year) || year < 1800 || year > 2100) {
      errors.push("Founded year must be between 1800 and 2100");
    }
  }

  if (errors.length) return sendValidationError(req, res, errors);
  next();
};

exports.validateCompanyCreate = makeCompanyValidator(false);
exports.validateCompanyUpdate = makeCompanyValidator(true);

const makeLocationValidator = (isUpdate) => (req, res, next) => {
  const errors = [];
  const { company_id, name, email } = req.body || {};

  if (!isUpdate) {
    if (!isValidObjectId(company_id)) {
      errors.push("Valid company_id is required");
    }
    if (!name || !String(name).trim()) {
      errors.push("Location name is required");
    }
  } else {
    if (company_id !== undefined && !isValidObjectId(company_id)) {
      errors.push("Invalid company_id");
    }
    if (name !== undefined && !String(name).trim()) {
      errors.push("Location name cannot be empty");
    }
  }

  if (email !== undefined && String(email).trim() !== "") {
    if (!EMAIL_REGEX.test(String(email).trim())) {
      errors.push("Invalid email address");
    }
  }

  if (errors.length) return sendValidationError(req, res, errors);
  next();
};

exports.validateLocationCreate = makeLocationValidator(false);
exports.validateLocationUpdate = makeLocationValidator(true);

const makeDeviceValidator = (isUpdate) => (req, res, next) => {
  const errors = [];
  const { deviceId, deviceName, company_id, location_id, status } =
    req.body || {};

  if (!isUpdate) {
    if (!deviceId || !String(deviceId).trim()) {
      errors.push("Device ID is required");
    }
    if (!deviceName || !String(deviceName).trim()) {
      errors.push("Device name is required");
    }
    if (!isValidObjectId(company_id)) {
      errors.push("Valid company_id is required");
    }
  } else {
    if (deviceId !== undefined && !String(deviceId).trim()) {
      errors.push("Device ID cannot be empty");
    }
    if (deviceName !== undefined && !String(deviceName).trim()) {
      errors.push("Device name cannot be empty");
    }
    if (company_id !== undefined && !isValidObjectId(company_id)) {
      errors.push("Invalid company_id");
    }
  }

  if (location_id !== undefined) {
    const locArr = Array.isArray(location_id)
      ? location_id
      : location_id
        ? [location_id]
        : [];
    if (locArr.some((id) => !isValidObjectId(String(id)))) {
      errors.push("All location_id entries must be valid ObjectIds");
    }
  }

  if (status !== undefined && !["active", "inactive"].includes(status)) {
    errors.push("Status must be active or inactive");
  }

  if (errors.length) return sendValidationError(req, res, errors);
  next();
};

exports.validateDeviceCreate = makeDeviceValidator(false);
exports.validateDeviceUpdate = makeDeviceValidator(true);

const makeAdvertisementValidator = (isUpdate) => (req, res, next) => {
  const errors = [];
  const {
    title,
    company_ids,
    location_ids,
    playOrder,
    displayDuration,
    priority,
    startTime,
    endTime,
    startDate,
    endDate,
    days,
  } = req.body || {};

  if (!isUpdate) {
    if (!title || !String(title).trim()) {
      errors.push("Advertisement title is required");
    }
    const parsedCompanies = parseArrayField(company_ids);
    if (
      !parsedCompanies ||
      parsedCompanies.length === 0 ||
      parsedCompanies.some((id) => !isValidObjectId(String(id)))
    ) {
      errors.push("At least one valid company_ids entry is required");
    }

    const parsedLocations = parseArrayField(location_ids);
    if (
      !parsedLocations ||
      parsedLocations.length === 0 ||
      parsedLocations.some((id) => !isValidObjectId(String(id)))
    ) {
      errors.push("At least one valid location_ids entry is required");
    }
  } else {
    if (title !== undefined && !String(title).trim()) {
      errors.push("Advertisement title cannot be empty");
    }
    if (company_ids !== undefined) {
      const parsedCompanies = parseArrayField(company_ids);
      if (
        !parsedCompanies ||
        parsedCompanies.some((id) => !isValidObjectId(String(id)))
      ) {
        errors.push("Invalid company_ids");
      }
    }
    if (location_ids !== undefined) {
      const parsedLocations = parseArrayField(location_ids);
      if (
        !parsedLocations ||
        parsedLocations.some((id) => !isValidObjectId(String(id)))
      ) {
        errors.push("Invalid location_ids");
      }
    }
  }

  if (playOrder !== undefined && String(playOrder).trim() !== "") {
    const num = Number(playOrder);
    if (!Number.isFinite(num) || num < 1) {
      errors.push("Play order must be a number >= 1");
    }
  }

  if (displayDuration !== undefined && String(displayDuration).trim() !== "") {
    const dur = Number(displayDuration);
    if (!Number.isFinite(dur) || dur < 1) {
      errors.push("Display duration must be a number >= 1");
    }
  }

  if (priority !== undefined && String(priority).trim() !== "") {
    const prio = Number(priority);
    if (!Number.isFinite(prio) || prio < 1) {
      errors.push("Priority must be a number >= 1");
    }
  }

  if (startTime !== undefined && String(startTime).trim() !== "") {
    if (!TIME_REGEX.test(String(startTime).trim())) {
      errors.push("startTime must be in HH:MM format");
    }
  }

  if (endTime !== undefined && String(endTime).trim() !== "") {
    if (!TIME_REGEX.test(String(endTime).trim())) {
      errors.push("endTime must be in HH:MM format");
    }
  }

  const hasStart = startDate !== undefined && String(startDate).trim() !== "";
  const hasEnd = endDate !== undefined && String(endDate).trim() !== "";

  if (hasStart && Number.isNaN(new Date(startDate).getTime())) {
    errors.push("Invalid startDate");
  }
  if (hasEnd && Number.isNaN(new Date(endDate).getTime())) {
    errors.push("Invalid endDate");
  }
  if (
    hasStart &&
    hasEnd &&
    !Number.isNaN(new Date(startDate).getTime()) &&
    !Number.isNaN(new Date(endDate).getTime()) &&
    new Date(startDate) > new Date(endDate)
  ) {
    errors.push("startDate must be before or equal to endDate");
  }

  if (days !== undefined && String(days).trim() !== "") {
    const parsedDays = parseArrayField(days);
    if (
      !parsedDays ||
      parsedDays.some((d) => !ALLOWED_DAYS.includes(d))
    ) {
      errors.push("days must contain valid weekdays");
    }
  }

  if (errors.length) return sendValidationError(req, res, errors);
  next();
};

exports.validateAdvertisementCreate = makeAdvertisementValidator(false);
exports.validateAdvertisementUpdate = makeAdvertisementValidator(true);

exports.validateUserRoleUpdate = (req, res, next) => {
  const { role, company_id, newCompanyName } = req.body || {};
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return sendValidationError(req, res, ["Invalid role"]);
  }
  const hasExistingCompany = isValidObjectId(String(company_id || ""));
  const hasNewCompany = Boolean(String(newCompanyName || "").trim());
  if (role === "company_admin" && !hasExistingCompany && !hasNewCompany) {
    return sendValidationError(req, res, [
      "Select an existing company or enter a new company name for Company Admin",
    ]);
  }
  next();
};

exports.validateAdminCreateUser = (req, res, next) => {
  const errors = [];
  const { name, email, password, role, company_id, newCompanyName } =
    req.body || {};

  if (!name || !String(name).trim()) {
    errors.push("Name is required");
  }
  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    errors.push("Valid email is required");
  }
  if (!password || String(password).length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  const effectiveRole = role || "company_admin";
  if (!["company_admin", "customer"].includes(effectiveRole)) {
    errors.push("Role must be 'company_admin' or 'customer'");
  }

  if (effectiveRole === "company_admin") {
    const hasExistingCompany = isValidObjectId(String(company_id || ""));
    const hasNewCompany = Boolean(String(newCompanyName || "").trim());
    if (!hasExistingCompany && !hasNewCompany) {
      errors.push(
        "Select an existing company or enter a new company name for Company Admin"
      );
    }
  }

  if (errors.length) return sendValidationError(req, res, errors);
  next();
};
