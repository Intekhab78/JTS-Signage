const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://72.60.219.218:8080",
];

const parseAllowedOrigins = () => {
  const envOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return new Set([...defaultOrigins, ...envOrigins]);
};

const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const isNativeTvAppOrigin = (origin) =>
  origin === "null" ||
  origin.startsWith("file://") ||
  origin === "capacitor://localhost" ||
  origin.startsWith("https://appassets.androidplatform.net") ||
  origin.startsWith("app://");

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || isNativeTvAppOrigin(origin)) {
      return callback(null, true);
    }

    const allowedOrigins = parseAllowedOrigins();
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    if (
      process.env.NODE_ENV !== "production" &&
      localhostPattern.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

module.exports = corsOptions;
