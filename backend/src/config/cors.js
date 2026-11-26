const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:3000",
  "http://72.60.219.218:8080",
  "http://72.60.219.218:5055",
];

const parseAllowedOrigins = () => {
  const envOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return new Set([...defaultOrigins, ...envOrigins]);
};

const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const lanPattern =
  /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const isNativeTvAppOrigin = (origin) =>
  origin === "null" ||
  origin.startsWith("file://") ||
  origin === "capacitor://localhost" ||
  origin.startsWith("https://appassets.androidplatform.net") ||
  origin.startsWith("app://");

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || isNativeTvAppOrigin(origin) || lanPattern.test(origin)) {
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
