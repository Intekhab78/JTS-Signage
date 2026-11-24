const http = require("http");
const connectDB = require("./config/db");
require("dotenv").config();

const corsOptions = require("./config/cors");
const Device = require("./models/Device");
const app = require("./app");
const server = http.createServer(app);

connectDB().then(() => {
  Device.updateMany({ isOnline: true }, { $set: { isOnline: false } }).catch(
    (err) => console.error("Failed to reset device online flags:", err.message)
  );
});

/* ================= SOCKET.IO ================= */

const io = require("socket.io")(server, {
  cors: corsOptions,
});

const socketInstance = require("./socketInstance");
socketInstance.setIO(io);

require("./socket")(io);
const startAdScheduler = require("./scheduler/adScheduler");

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  startAdScheduler();
});
