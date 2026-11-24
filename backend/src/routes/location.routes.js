const express = require("express");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const {
  validateLocationCreate,
  validateLocationUpdate,
  validateObjectIdParam,
} = require("../middleware/validate.middleware");
const {
  createLocation,
  listLocationsByCompany,
  viewLocation,
  updateLocation,
  deleteLocation,
} = require("../controllers/location.controller");

const router = express.Router();

router.use(auth, role("admin", "company_admin"));

router.post("/create", validateLocationCreate, createLocation);
router.get(
  "/list/:companyId",
  validateObjectIdParam("companyId"),
  listLocationsByCompany
);
router.get("/details/:id", validateObjectIdParam("id"), viewLocation);
router.put(
  "/edit/:id",
  validateObjectIdParam("id"),
  validateLocationUpdate,
  updateLocation
);
router.delete("/delete/:id", validateObjectIdParam("id"), deleteLocation);

module.exports = router;
