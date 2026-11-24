const express = require("express");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const {
  getAnalyticsSummary,
  exportAnalyticsCsv,
} = require("../controllers/analytics.controller");

const router = express.Router();

router.use(auth, role("admin", "company_admin"));

router.get("/summary", getAnalyticsSummary);
router.get("/export", exportAnalyticsCsv);

module.exports = router;
