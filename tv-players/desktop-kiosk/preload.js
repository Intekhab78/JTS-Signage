const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("JTSSignageDesktop", {
  platform: process.platform,
  arch: process.arch,
});
