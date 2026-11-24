const path = require("path");
const {
  app,
  BrowserWindow,
  globalShortcut,
  powerSaveBlocker,
} = require("electron");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let mainWindow = null;
let blockerId = null;

const createKioskWindow = () => {
  mainWindow = new BrowserWindow({
    title: "JTS Signage",
    backgroundColor: "#000000",
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "www", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  blockerId = powerSaveBlocker.start("prevent-display-sleep");

  try {
    app.setLoginItemSettings({ openAtLogin: true });
  } catch {
    // Ignore on unsupported Linux desktop environments
  }

  createKioskWindow();

  globalShortcut.register("CommandOrControl+Shift+S", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        "window.JTSSignageToggleSettings && window.JTSSignageToggleSettings();"
      );
    }
  });

  globalShortcut.register("CommandOrControl+Shift+Q", () => {
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createKioskWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
