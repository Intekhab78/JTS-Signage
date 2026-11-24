const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const {
  validateObjectIdParam,
  validateUserRoleUpdate,
  validateAdminCreateUser,
} = require("../middleware/validate.middleware");
const ctrl = require("../controllers/admin.controller");

router.get("/users", auth, role("admin"), ctrl.getUsers);
router.post(
  "/users",
  auth,
  role("admin"),
  validateAdminCreateUser,
  ctrl.createClientUser
);
router.put(
  "/users/:id",
  auth,
  role("admin"),
  validateObjectIdParam("id"),
  validateUserRoleUpdate,
  ctrl.updateUserRole
);
router.get(
  "/dashboard",
  auth,
  role("admin", "company_admin"),
  ctrl.getDashboardStats
);
router.get(
  "/live-screens",
  auth,
  role("admin", "company_admin"),
  ctrl.getLiveScreens
);
router.get(
  "/alerts",
  auth,
  role("admin", "company_admin"),
  ctrl.getOfflineAlerts
);

module.exports = router;
