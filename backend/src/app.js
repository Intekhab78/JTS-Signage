const express = require("express");
const cors = require("cors");
const path = require("path");
const corsOptions = require("./config/cors");

const app = express();

/* ================= CORS SETUP ================= */

app.use(cors(corsOptions));

/* ================= MIDDLEWARE ================= */

app.use(express.json());

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Accept-Ranges", "bytes");
    next();
  },
  express.static(path.join(process.cwd(), "uploads"))
);

/* ================= ROUTES ================= */

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/company", require("./routes/company.routes"));
app.use("/api/location", require("./routes/location.routes"));
app.use("/api/advertisement", require("./routes/advertisement.routes"));
app.use("/api/devices", require("./routes/device.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/analytics", require("./routes/analytics.routes"));

/* ================= ERROR HANDLER ================= */

app.use((err, req, res, next) => {
  if (!err) return next();

  if (
    err.name === "MulterError" ||
    err.message === "Only video files are allowed" ||
    err.message === "Only video and image files are allowed"
  ) {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, message: err.message });
  }

  console.error("Unhandled Error:", err);
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

module.exports = app;
