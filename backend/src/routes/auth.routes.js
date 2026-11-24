const router = require("express").Router();
const ctrl = require("../controllers/auth.controller");
const {
  validateAuthRegister,
  validateAuthLogin,
  validateForgotPassword,
} = require("../middleware/validate.middleware");

router.get("/setup-status", ctrl.getSetupStatus);
router.post("/register", validateAuthRegister, ctrl.register);
router.post("/login", validateAuthLogin, ctrl.login);
router.post("/forgot-password", validateForgotPassword, ctrl.forgotPassword);

module.exports = router;
