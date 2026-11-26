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

/* ================= TV PLAYER & DIRECT DOWNLOADS ================= */

const fs = require("fs");
const tvPlayersDir = path.join(__dirname, "..", "..", "tv-players");
const playerCoreDir = path.join(tvPlayersDir, "player-core");
const tvDistDir = path.join(tvPlayersDir, "dist");

app.use("/tv", express.static(playerCoreDir));

const sendApk = (req, res) => {
  const apkPath = path.join(tvDistDir, "JTS-Signage-TV.apk");
  if (!fs.existsSync(apkPath)) {
    return res.status(404).json({ success: false, message: "APK not found" });
  }
  return res.download(apkPath, "JTS-Signage-TV.apk");
};

const sendWgt = (req, res) => {
  const wgtPath = path.join(tvDistDir, "JTS-Signage-Samsung-Tizen.wgt");
  if (!fs.existsSync(wgtPath)) {
    return res.status(404).json({ success: false, message: "WGT not found" });
  }
  return res.download(wgtPath, "JTS-Signage-Samsung-Tizen.wgt");
};

app.get("/download/apk", sendApk);
app.get("/tv.apk", sendApk);
app.get("/download/samsung", sendWgt);
app.get("/sssp/JTS-Signage-Samsung-Tizen.wgt", sendWgt);

const sendSsspConfig = (req, res) => {
  const wgtPath = path.join(tvDistDir, "JTS-Signage-Samsung-Tizen.wgt");
  const wgtSize = fs.existsSync(wgtPath) ? fs.statSync(wgtPath).size : 0;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  return res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<widget>\n  <ver>1.0.0</ver>\n  <size>${wgtSize}</size>\n  <widgetname>JTS-Signage-Samsung-Tizen</widgetname>\n</widget>\n`
  );
};

app.get("/sssp/sssp_config.xml", sendSsspConfig);
app.get("/sssp", sendSsspConfig);

app.get("/download", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JTS Signage — TV Player Download &amp; Launch</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0b1220;
      color: #f8fafc;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      padding: 24px;
    }
    .card {
      max-width: 680px;
      width: 100%;
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
      text-align: center;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    p.sub { color: #94a3b8; font-size: 15px; margin-bottom: 28px; }
    .actions { display: flex; flex-direction: column; gap: 14px; }
    a.btn {
      display: block;
      padding: 18px 22px;
      border-radius: 14px;
      text-decoration: none;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      border: 2px solid transparent;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    a.btn:focus, a.btn:hover {
      outline: none;
      transform: scale(1.02);
      border-color: #93c5fd;
    }
    .btn-primary { background: #2563eb; }
    .btn-emerald { background: #059669; }
    .btn-slate { background: #334155; }
    .hint { display: block; font-size: 12px; font-weight: 400; color: #e2e8f0; margin-top: 4px; opacity: 0.85; }
  </style>
</head>
<body>
  <main class="card">
    <h1>JTS Signage TV Setup</h1>
    <p class="sub">Choose an option for your TV screen (use TV remote arrows + OK)</p>
    <div class="actions">
      <a class="btn btn-primary" href="/tv">
        Open TV Player in Browser
        <span class="hint">Best for Samsung Tizen &amp; LG webOS Smart TVs — pairs once &amp; remembers TV</span>
      </a>
      <a class="btn btn-emerald" href="/download/apk">
        Download Android TV / Fire TV App (.apk)
        <span class="hint">Direct install without pendrive on Android TV, Google TV &amp; Android Box</span>
      </a>
      <a class="btn btn-slate" href="/download/samsung">
        Download Samsung Tizen App (.wgt)
        <span class="hint">For Samsung Commercial SSSP URL Launcher (/sssp) &amp; Tizen Studio</span>
      </a>
    </div>
  </main>
</body>
</html>`);
});

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
