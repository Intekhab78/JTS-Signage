const Location = require("../models/Location");
const Company = require("../models/Company");

/**
 * @desc    Create Location
 * @route   POST /api/location/create
 */
exports.createLocation = async (req, res) => {
  try {
    if (req.user?.role === "company_admin") {
      req.body.company_id = req.user.company_id;
    }

    const { company_id } = req.body;

    const companyExists = await Company.findById(company_id);
    if (!companyExists) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const location = await Location.create(req.body);

    res.status(201).json({
      success: true,
      message: "Location created successfully",
      data: location,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    List Locations by Company
 * @route   GET /api/location/list/:companyId
 */
exports.listLocationsByCompany = async (req, res) => {
  try {
    if (
      req.user?.role === "company_admin" &&
      String(req.params.companyId) !== String(req.user.company_id || "")
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const locations = await Location.find({
      company_id: req.params.companyId,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    View Location
 * @route   GET /api/location/details/:id
 */
exports.viewLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id).populate(
      "company_id",
      "name"
    );

    if (!location || !location.isActive) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    if (
      req.user?.role === "company_admin" &&
      String(location.company_id?._id || location.company_id) !==
        String(req.user.company_id || "")
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update Location
 * @route   PUT /api/location/edit/:id
 */
exports.updateLocation = async (req, res) => {
  try {
    const existing = await Location.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    if (req.user?.role === "company_admin") {
      if (String(existing.company_id) !== String(req.user.company_id || "")) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
      req.body.company_id = req.user.company_id;
    }

    const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: location,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Soft Delete Location
 * @route   DELETE /api/location/delete/:id
 */
exports.deleteLocation = async (req, res) => {
  try {
    const existing = await Location.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    if (
      req.user?.role === "company_admin" &&
      String(existing.company_id) !== String(req.user.company_id || "")
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await Location.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Location deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
