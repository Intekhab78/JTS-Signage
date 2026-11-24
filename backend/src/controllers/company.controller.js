const Company = require("../models/Company");

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * @desc    Create Company
 * @route   POST /api/company/create
 */
exports.createCompany = async (req, res) => {
  try {
    const company = await Company.create(req.body);

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      data: company,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    List Companies (only active; tenant-scoped for company_admin)
 * @route   GET /api/company/list
 */
exports.listCompanies = async (req, res) => {
  try {
    const { page = 1, limit, search = "" } = req.query;

    const query = {
      isActive: true,
      ...(search
        ? { name: { $regex: escapeRegex(search), $options: "i" } }
        : {}),
    };

    if (req.user?.role === "company_admin") {
      if (!req.user.company_id) {
        return res.status(200).json({
          success: true,
          total: 0,
          page: 1,
          limit: 0,
          data: [],
        });
      }
      query._id = req.user.company_id;
    }

    const parsedLimit = Number(limit);
    const parsedPage = Math.max(1, Number(page) || 1);

    let companyQuery = Company.find(query).sort({ createdAt: -1 });
    if (limit !== undefined && parsedLimit > 0) {
      companyQuery = companyQuery
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit);
    }

    const [companies, total] = await Promise.all([
      companyQuery,
      Company.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parsedPage,
      limit: parsedLimit > 0 ? parsedLimit : total,
      data: companies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    View Company
 * @route   GET /api/company/details/:id
 */
exports.viewCompany = async (req, res) => {
  try {
    if (
      req.user?.role === "company_admin" &&
      String(req.params.id) !== String(req.user.company_id || "")
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const company = await Company.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update Company
 * @route   PUT /api/company/edit/:id
 */
exports.updateCompany = async (req, res) => {
  try {
    if (
      req.user?.role === "company_admin" &&
      String(req.params.id) !== String(req.user.company_id || "")
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const company = await Company.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      req.body,
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found or inactive",
      });
    }

    res.status(200).json({
      success: true,
      message: "Company updated successfully",
      data: company,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Soft Delete Company (set inactive)
 * @route   DELETE /api/company/delete/:id
 */
exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Company deactivated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
