const express = require("express");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const {
  validateCompanyCreate,
  validateCompanyUpdate,
  validateObjectIdParam,
} = require("../middleware/validate.middleware");
const {
  createCompany,
  listCompanies,
  viewCompany,
  updateCompany,
  deleteCompany,
} = require("../controllers/company.controller");

const router = express.Router();

router.use(auth);

router.post("/create", role("admin"), validateCompanyCreate, createCompany);
router.get("/list", role("admin", "company_admin"), listCompanies);
router.get(
  "/details/:id",
  role("admin", "company_admin"),
  validateObjectIdParam("id"),
  viewCompany
);
router.put(
  "/edit/:id",
  role("admin", "company_admin"),
  validateObjectIdParam("id"),
  validateCompanyUpdate,
  updateCompany
);
router.delete(
  "/delete/:id",
  role("admin"),
  validateObjectIdParam("id"),
  deleteCompany
);

module.exports = router;
