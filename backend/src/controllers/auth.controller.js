const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const ALLOWED_ROLES = ["customer", "agent", "company_admin", "admin"];

exports.getSetupStatus = async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: "admin" });
    res.status(200).json({ hasAdmin: adminCount > 0 });
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to check setup status" });
  }
};

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      companyName,
      requestedCompanyName,
    } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const adminCount = await User.countDocuments({ role: "admin" });
    let finalRole;

    if (adminCount === 0) {
      finalRole = "admin";
    } else {
      if (role === "company_admin") {
        return res.status(403).json({
          message: "Company Admin accounts must be assigned by a Super Admin.",
        });
      }
      if (role === "admin") {
        return res.status(403).json({
          message:
            "Admin registration is disabled. Ask an existing admin to promote your account.",
        });
      }
      finalRole =
        role && ["customer", "agent"].includes(role) ? role : "customer";
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: "User exists" });

    const hash = await bcrypt.hash(password, 10);

    await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hash,
      role: finalRole,
      requestedCompanyName:
        finalRole === "admin"
          ? ""
          : String(companyName || requestedCompanyName || "").trim(),
    });

    res.json({
      message:
        adminCount === 0
          ? "Initial Admin account created successfully"
          : "Registered successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Registration failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        company_id: user.company_id || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        company_id: user.company_id || null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    await User.findOne({ email: String(email).trim().toLowerCase() });

    res.status(200).json({
      message:
        "If this email is registered, password reset instructions have been sent.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to process request" });
  }
};
