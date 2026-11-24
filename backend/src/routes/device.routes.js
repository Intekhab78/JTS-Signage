const express = require("express");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const {
  validateDeviceCreate,
  validateDeviceUpdate,
  validateObjectIdParam,
} = require("../middleware/validate.middleware");
const router = express.Router();

const {
  requestPairingCode,
  completePairing,
  createDevice,
  getAllDevices,
  getDeviceById,
  updateDevice,
  updateDeviceSettings,
  sendDeviceCommand,
  deleteDevice,
  checkDevice,
  getDeviceByToken,
  registerDevice,
} = require("../controllers/device.controller");

/* =======================================================
   ✅ PUBLIC PLAYER & PAIRING ROUTES (SMART TV ACCESS)
======================================================= */
router.get("/by-token/:token", getDeviceByToken);
router.post("/pair/request", requestPairingCode);

/* =======================================================
   🔐 ADMIN & COMPANY ADMIN PROTECTED ROUTES
======================================================= */
router.use(auth, role("admin", "company_admin"));

router.post("/pair/complete", completePairing);
router.post("/create", validateDeviceCreate, createDevice);
router.post("/register", registerDevice);
router.get("/check/:deviceId", checkDevice);
router.get("/list", getAllDevices);
router.get("/listbyid/:id", validateObjectIdParam("id"), getDeviceById);
router.put(
  "/update/:id",
  validateObjectIdParam("id"),
  validateDeviceUpdate,
  updateDevice
);
router.put(
  "/settings/:id",
  validateObjectIdParam("id"),
  updateDeviceSettings
);
router.post(
  "/command/:id",
  validateObjectIdParam("id"),
  sendDeviceCommand
);
router.delete("/delete/:id", validateObjectIdParam("id"), deleteDevice);

module.exports = router;
