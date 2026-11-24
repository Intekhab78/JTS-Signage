const sessions = new Map();

const purgeExpired = () => {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (session.expiresAt.getTime() <= now) {
      sessions.delete(code);
    }
  }
};

exports.hasCode = (code) => {
  purgeExpired();
  return sessions.has(String(code).trim());
};

exports.createSession = ({ code, expiresAt }) => {
  purgeExpired();
  const normalized = String(code).trim();
  const entry = {
    code: normalized,
    status: "pending",
    socketId: null,
    pairedDeviceId: null,
    screenToken: null,
    expiresAt: new Date(expiresAt),
  };
  sessions.set(normalized, entry);
  return entry;
};

exports.getPendingSession = (code) => {
  purgeExpired();
  const entry = sessions.get(String(code).trim());
  if (!entry || entry.status !== "pending") return null;
  return entry;
};

exports.markPaired = (code, { pairedDeviceId, screenToken }) => {
  purgeExpired();
  const entry = sessions.get(String(code).trim());
  if (!entry) return null;
  entry.status = "paired";
  entry.pairedDeviceId = pairedDeviceId;
  entry.screenToken = screenToken;
  return entry;
};

exports.attachSocket = (code, socketId) => {
  purgeExpired();
  const entry = sessions.get(String(code).trim());
  if (!entry) return null;
  entry.socketId = socketId;
  return entry;
};
