const express = require("express");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const {
  validateAdvertisementCreate,
  validateAdvertisementUpdate,
  validateObjectIdParam,
} = require("../middleware/validate.middleware");

const {
  createAdvertisement,
  viewAdvertisement,
  updateAdvertisement,
  reorderAdvertisements,
  deleteAdvertisement,
  listAdvertisements,
  playAdvertisements,
  stopAdvertisements,
  pauseAdvertisements,
  playByLocation,
  playByCompany,
  pauseBulk,
  stopBulk,
  emergencyOverride,
} = require("../controllers/advertisement.controller");

const uploadVideo = require("../middleware/uploadVideo");

const router = express.Router();

router.use(auth, role("admin", "company_admin"));

router.post(
  "/create",
  uploadVideo.single("video"),
  validateAdvertisementCreate,
  createAdvertisement
);

router.get("/list", listAdvertisements);
router.get("/details/:id", validateObjectIdParam("id"), viewAdvertisement);

router.put("/reorder", reorderAdvertisements);
router.put(
  "/edit/:id",
  validateObjectIdParam("id"),
  uploadVideo.single("video"),
  validateAdvertisementUpdate,
  updateAdvertisement
);

router.delete("/delete/:id", validateObjectIdParam("id"), deleteAdvertisement);

router.post("/play", playAdvertisements);
router.post("/stop", stopAdvertisements);
router.post("/pause", pauseAdvertisements);

router.post("/play-location", playByLocation);
router.post("/play-company", playByCompany);
router.post("/pause-bulk", pauseBulk);
router.post("/stop-bulk", stopBulk);
router.post("/emergency-override", emergencyOverride);

module.exports = router;
