(function () {
  "use strict";

  var DEFAULT_SERVER_URL = "http://72.60.219.218:5055";
  var STORAGE_SERVER_KEY = "jts_server_url";
  var STORAGE_TOKEN_KEY = "jts_screen_token";
  var STORAGE_PLAYLIST_PREFIX = "jts_offline_playlist_";

  var els = {
    stage: document.getElementById("stage"),
    playerLayer: document.getElementById("player-layer"),
    waitingLayer: document.getElementById("waiting-layer"),
    pairingLayer: document.getElementById("pairing-layer"),
    emergencyLayer: document.getElementById("emergency-layer"),
    settingsLayer: document.getElementById("settings-layer"),
    video: document.getElementById("ad-video"),
    image: document.getElementById("ad-image"),
    offlineBadge: document.getElementById("offline-badge"),
    pausedBanner: document.getElementById("paused-banner"),
    tickerBar: document.getElementById("ticker-bar"),
    tickerText: document.getElementById("ticker-text"),
    waitingSubtitle: document.getElementById("waiting-subtitle"),
    waitingMeta: document.getElementById("waiting-meta"),
    pairCode: document.getElementById("pair-code"),
    pairStatus: document.getElementById("pair-status"),
    pairError: document.getElementById("pair-error"),
    emergencyTitle: document.getElementById("emergency-title"),
    emergencyMessage: document.getElementById("emergency-message"),
    inputServerUrl: document.getElementById("input-server-url"),
    infoPlatform: document.getElementById("info-platform"),
    infoDeviceId: document.getElementById("info-device-id"),
    infoToken: document.getElementById("info-token"),
    infoConn: document.getElementById("info-conn"),
    settingsFeedback: document.getElementById("settings-feedback"),
    btnNewCode: document.getElementById("btn-new-code"),
    btnPairSettings: document.getElementById("btn-pair-settings"),
    btnWaitingSettings: document.getElementById("btn-waiting-settings"),
    btnCloseSettings: document.getElementById("btn-close-settings"),
    btnSaveServer: document.getElementById("btn-save-server"),
    btnTestServer: document.getElementById("btn-test-server"),
    btnUnpair: document.getElementById("btn-unpair"),
    hotspot: document.getElementById("gesture-hotspot"),
    pairConn: document.getElementById("pair-conn"),
    waitConn: document.getElementById("wait-conn"),
    pairServer: document.getElementById("pair-server"),
  };

  var state = {
    serverUrl: loadServerUrl(),
    screenToken: loadToken(),
    deviceId: null,
    locationId: null,
    playlist: [],
    currentIndex: 0,
    isPaused: false,
    emergencyAlert: null,
    emergencyTimer: null,
    imageTimer: null,
    heartbeatTimer: null,
    pendingSeek: null,
    resumeTime: 0,
    playStartedAt: new Date().toISOString(),
    settings: { volume: 100, muted: false, orientation: "0" },
    socket: null,
    pairSocket: null,
    pairingCode: "",
    pairTimer: null,
  };

  /* ==================== UI HELPERS ==================== */
  function setConnStatus(kind, text) {
    [els.pairConn, els.waitConn].forEach(function (pill) {
      if (!pill) return;
      pill.className = "status-pill status-" + kind;
      var label = pill.querySelector(".status-text");
      if (label) label.textContent = text;
    });
  }

  function renderPairCode(code) {
    var box = els.pairCode;
    if (!box) return;
    var digits = String(code || "").replace(/\D/g, "").slice(0, 6);
    box.innerHTML = "";
    box.className = "code-digits" + (digits ? "" : " is-loading");
    for (var i = 0; i < 6; i++) {
      var cell = document.createElement("span");
      var ch = digits.charAt(i);
      cell.className =
        "code-digit" + (ch ? "" : " is-empty") + (i === 2 ? " gap-after" : "");
      cell.textContent = ch || "•";
      box.appendChild(cell);
    }
  }

  function clearPairTimer() {
    if (state.pairTimer) {
      clearInterval(state.pairTimer);
      state.pairTimer = null;
    }
  }

  function startPairCountdown(expiresAt) {
    clearPairTimer();
    var expiryMs = new Date(expiresAt).getTime();
    if (!isFinite(expiryMs)) {
      els.pairStatus.textContent = "Waiting for pairing from Admin Panel…";
      return;
    }
    var tick = function () {
      var left = Math.max(0, Math.round((expiryMs - Date.now()) / 1000));
      if (left <= 0) {
        clearPairTimer();
        els.pairStatus.textContent = "Code expired. Getting a new code…";
        startPairingMode();
        return;
      }
      var m = Math.floor(left / 60);
      var s = left % 60;
      els.pairStatus.textContent =
        "Waiting for pairing  •  Code expires in " + m + ":" + (s < 10 ? "0" : "") + s;
    };
    tick();
    state.pairTimer = setInterval(tick, 1000);
  }

  function normalizeServerUrl(url) {
    var trimmed = String(url || "").trim().replace(/\/+$/, "");
    if (!trimmed) return DEFAULT_SERVER_URL;
    return trimmed;
  }

  function loadServerUrl() {
    try {
      var saved = localStorage.getItem(STORAGE_SERVER_KEY);
      if (saved) {
        var normalized = normalizeServerUrl(saved);
        if (normalized === "https://vms-backend-ctea.onrender.com") {
          localStorage.removeItem(STORAGE_SERVER_KEY);
          return DEFAULT_SERVER_URL;
        }
        return normalized;
      }
    } catch (_) {}

    if (
      typeof location !== "undefined" &&
      (location.protocol === "http:" || location.protocol === "https:") &&
      location.hostname
    ) {
      return location.protocol + "//" + location.hostname + ":5000";
    }
    return DEFAULT_SERVER_URL;
  }

  function loadToken() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var fromQuery = params.get("token") || params.get("screen");
      if (fromQuery) {
        localStorage.setItem(STORAGE_TOKEN_KEY, fromQuery);
        return fromQuery;
      }
      return localStorage.getItem(STORAGE_TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function detectPlatformLabel() {
    if (window.JTSSignageAndroid && typeof window.JTSSignageAndroid.getPlatform === "function") {
      try {
        return window.JTSSignageAndroid.getPlatform();
      } catch (_) {}
    }
    if (window.JTSSignageDesktop && window.JTSSignageDesktop.platform) {
      return "Desktop Kiosk (" + window.JTSSignageDesktop.platform + ")";
    }
    if (typeof window.tizen !== "undefined") {
      return "Samsung Tizen TV";
    }
    if (typeof window.webOS !== "undefined" || navigator.userAgent.indexOf("Web0S") !== -1) {
      return "LG webOS TV";
    }
    return "Universal Native Player";
  }

  function requestPlatformWakeLock() {
    try {
      if (window.tizen && window.tizen.power && window.tizen.power.request) {
        window.tizen.power.request("SCREEN", "SCREEN_NORMAL");
      }
    } catch (_) {}
  }

  function resolveMediaUrl(videoPath) {
    if (!videoPath) return "";
    if (/^https?:\/\//i.test(videoPath)) return videoPath;
    return (
      normalizeServerUrl(state.serverUrl) +
      (videoPath.charAt(0) === "/" ? "" : "/") +
      videoPath
    );
  }

  function isImageAd(ad) {
    if (!ad) return false;
    if (ad.mediaType === "image") return true;
    return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(ad.videoPath || "");
  }

  function canUseCacheStorage() {
    try {
      return (
        "caches" in window &&
        (location.protocol === "https:" || location.hostname === "localhost")
      );
    } catch (_) {
      return false;
    }
  }

  function saveOfflinePlaylist(token, payload) {
    if (!token) return;
    try {
      localStorage.setItem(
        STORAGE_PLAYLIST_PREFIX + token,
        JSON.stringify({
          deviceId: payload.deviceId,
          locationId: payload.locationId,
          ads: payload.ads || [],
          savedAt: Date.now(),
        })
      );
    } catch (_) {}
  }

  function loadOfflinePlaylist(token) {
    if (!token) return null;
    try {
      var raw = localStorage.getItem(STORAGE_PLAYLIST_PREFIX + token);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearOfflineCache(token) {
    if (token) {
      try {
        localStorage.removeItem(STORAGE_PLAYLIST_PREFIX + token);
      } catch (_) {}
    }
    if (canUseCacheStorage()) {
      try {
        window.caches.delete("vms-media-cache-v1");
      } catch (_) {}
    }
  }

  function setOfflineBadge(isOffline) {
    if (isOffline) {
      els.offlineBadge.classList.remove("hidden");
    } else {
      els.offlineBadge.classList.add("hidden");
    }
  }

  function updateStageOrientation() {
    var orientation = String(state.settings.orientation || "0");
    var stage = els.stage;
    if (orientation === "90" || orientation === "270") {
      stage.style.width = "100vh";
      stage.style.height = "100vw";
      stage.style.position = "absolute";
      stage.style.top = "50%";
      stage.style.left = "50%";
      stage.style.transform =
        "translate(-50%, -50%) rotate(" + orientation + "deg)";
    } else {
      stage.style.width = "100%";
      stage.style.height = "100%";
      stage.style.position = "relative";
      stage.style.top = "";
      stage.style.left = "";
      stage.style.transform =
        orientation === "180" ? "rotate(180deg)" : "";
    }
  }

  function applyAudioSettings() {
    var video = els.video;
    if (!video) return;
    var vol = Math.max(0, Math.min(1, (Number(state.settings.volume) || 100) / 100));
    video.volume = vol;
    video.muted = Boolean(state.settings.muted);
  }

  function safePlayVideo() {
    var video = els.video;
    if (!video) return;
    applyAudioSettings();
    var p = video.play();
    if (p && typeof p.catch === "function") {
      p.catch(function (err) {
        if (err && err.name === "NotAllowedError" && !video.muted) {
          video.muted = true;
          video.play().catch(function () {});
        }
      });
    }
  }

  function seekVideoSafely(video, rawTargetTime, thresholdSec) {
    if (!video || !isFinite(rawTargetTime) || rawTargetTime < 0) return false;
    if (video.readyState < 1) return false;

    var target =
      isFinite(video.duration) && video.duration > 0.5
        ? rawTargetTime % video.duration
        : rawTargetTime;

    try {
      if (video.seekable && video.seekable.length > 0) {
        var minS = video.seekable.start(0);
        var maxS = video.seekable.end(video.seekable.length - 1);
        if (isFinite(minS) && isFinite(maxS) && maxS > minS) {
          target = Math.max(minS, Math.min(target, maxS));
        }
      }
    } catch (_) {}

    if (Math.abs(video.currentTime - target) > thresholdSec) {
      video.currentTime = target;
    }
    return Math.abs(video.currentTime - target) <= thresholdSec;
  }

  function showLayer(name) {
    els.playerLayer.classList.toggle("hidden", name !== "player");
    els.waitingLayer.classList.toggle("hidden", name !== "waiting");
    els.pairingLayer.classList.toggle("hidden", name !== "pairing");
  }

  function updateInfoDisplay() {
    els.infoPlatform.textContent = detectPlatformLabel();
    els.infoDeviceId.textContent = state.deviceId || "Unpaired";
    els.infoToken.textContent = state.screenToken || "—";
    els.infoConn.textContent =
      state.socket && state.socket.connected ? "Connected (Live)" : "Disconnected";
    els.waitingMeta.textContent = state.deviceId
      ? "Device " + state.deviceId + "  •  " + state.serverUrl
      : state.serverUrl;
    if (els.pairServer) els.pairServer.textContent = state.serverUrl;
  }

  function emitPlayingVideo(videoPath, currentTime) {
    if (!state.socket || !state.deviceId) return;
    state.socket.emit("playing_video", {
      deviceId: state.deviceId,
      videoPath: videoPath,
      currentTime: currentTime,
    });
  }

  function emitAdPlayed(ad, durationSec) {
    if (!state.socket || !state.deviceId || !ad) return;
    state.socket.emit("ad_played", {
      deviceId: state.deviceId,
      advertisementId: ad._id,
      adTitle: ad.title,
      mediaType: isImageAd(ad) ? "image" : "video",
      durationSeconds: Math.max(0, Math.round(durationSec || 0)),
      startedAt: state.playStartedAt,
      endedAt: new Date().toISOString(),
    });
  }

  function clearTimers() {
    if (state.imageTimer) {
      clearTimeout(state.imageTimer);
      state.imageTimer = null;
    }
  }

  function renderCurrentAd() {
    clearTimers();

    if (!state.playlist.length) {
      els.video.pause();
      els.video.removeAttribute("src");
      els.video.removeAttribute("data-media-src");
      els.video.load();
      els.image.src = "";
      showLayer("waiting");
      return;
    }

    var ad = state.playlist[state.currentIndex];
    if (!ad) {
      showLayer("waiting");
      return;
    }

    showLayer("player");
    els.pausedBanner.classList.toggle("hidden", !state.isPaused);
    els.tickerBar.classList.remove("hidden");
    els.tickerText.textContent =
      ad.tickerText || ad.title || "Welcome to JTS Signage";
    state.playStartedAt = new Date().toISOString();

    var url = resolveMediaUrl(ad.videoPath);

    if (isImageAd(ad)) {
      els.video.pause();
      els.video.classList.add("hidden");
      els.image.classList.remove("hidden");
      els.image.src = url;

      if (!state.isPaused && !state.emergencyAlert) {
        emitPlayingVideo(ad.videoPath, 0);
        var durationSec = Math.max(1, Number(ad.displayDuration) || 10);
        state.imageTimer = setTimeout(function () {
          emitAdPlayed(ad, durationSec);
          if (state.playlist.length > 1) {
            state.currentIndex = (state.currentIndex + 1) % state.playlist.length;
            renderCurrentAd();
          }
        }, durationSec * 1000);
      }
      return;
    }

    els.image.classList.add("hidden");
    els.image.src = "";
    els.video.classList.remove("hidden");

    if (els.video.getAttribute("data-media-src") !== url) {
      if (state.pendingSeek == null && state.resumeTime > 0) {
        state.pendingSeek = state.resumeTime;
      }
      state.resumeTime = 0;

      els.video.pause();
      els.video.removeAttribute("src");
      els.video.setAttribute("data-media-src", url);
      els.video.src = url;
      els.video.load();
    } else if (!state.isPaused && !state.emergencyAlert && els.video.paused) {
      safePlayVideo();
    }
  }

  /* ==================== VIDEO ELEMENT EVENTS ==================== */
  els.video.addEventListener("loadedmetadata", function () {
    if (state.pendingSeek != null) {
      seekVideoSafely(els.video, state.pendingSeek, 0.5);
    }
    if (!state.isPaused && !state.emergencyAlert) {
      safePlayVideo();
    }
  });

  els.video.addEventListener("canplay", function () {
    if (state.pendingSeek != null) {
      var aligned = seekVideoSafely(els.video, state.pendingSeek, 0.5);
      if (aligned) state.pendingSeek = null;
    }
    if (els.video.paused && !state.isPaused && !state.emergencyAlert) {
      safePlayVideo();
    }
  });

  els.video.addEventListener("play", function () {
    if (state.isPaused || state.emergencyAlert) {
      els.video.pause();
      return;
    }
    var ad = state.playlist[state.currentIndex];
    if (ad) {
      emitPlayingVideo(ad.videoPath, els.video.currentTime || 0);
    }
  });

  els.video.addEventListener("ended", function () {
    state.pendingSeek = null;
    var ad = state.playlist[state.currentIndex];
    emitAdPlayed(ad, els.video.duration || 0);
    state.playStartedAt = new Date().toISOString();

    if (state.playlist.length > 1) {
      state.currentIndex = (state.currentIndex + 1) % state.playlist.length;
      renderCurrentAd();
    } else if (!state.isPaused && !state.emergencyAlert) {
      els.video.currentTime = 0;
      safePlayVideo();
    }
  });

  /* ==================== SOCKET & DEVICE LIFECYCLE ==================== */
  function disconnectSockets() {
    clearPairTimer();
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    if (state.pairSocket) {
      state.pairSocket.disconnect();
      state.pairSocket = null;
    }
  }

  function connectDeviceSocket() {
    disconnectSockets();
    if (!state.deviceId) return;

    var socket = window.io(state.serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    state.socket = socket;

    socket.on("connect", function () {
      setOfflineBadge(false);
      setConnStatus("ok", "Online");
      updateInfoDisplay();
      socket.emit("register_device", {
        deviceId: state.deviceId,
        locationId: state.locationId || null,
      });
    });

    socket.on("disconnect", function () {
      setOfflineBadge(true);
      setConnStatus("err", "Offline");
      updateInfoDisplay();
    });

    socket.on("play_ads", function (payload) {
      if (!payload || payload.deviceId !== state.deviceId) return;
      var ads = payload.ads;
      if (!Array.isArray(ads) || ads.length === 0) return;

      var incomingSig = ads
        .map(function (a) {
          return String(a._id);
        })
        .join(",");
      var currentSig = state.playlist
        .map(function (a) {
          return String(a._id);
        })
        .join(",");
      var activeAd = state.playlist[state.currentIndex];
      var videoPlaying =
        els.video &&
        !els.video.paused &&
        !els.video.ended &&
        els.video.readyState >= 2;

      if (
        !payload.startPaused &&
        !state.isPaused &&
        incomingSig === currentSig &&
        state.playlist.length > 0 &&
        (payload.resumeTime == null || payload.resumeTime === 0) &&
        (videoPlaying || (activeAd && isImageAd(activeAd)))
      ) {
        return;
      }

      var safeIdx =
        typeof payload.startIndex === "number" &&
        payload.startIndex >= 0 &&
        payload.startIndex < ads.length
          ? payload.startIndex
          : 0;

      saveOfflinePlaylist(state.screenToken, {
        deviceId: state.deviceId,
        locationId: state.locationId,
        ads: ads,
      });

      if (payload.startPaused) {
        state.isPaused = true;
        state.pendingSeek = payload.resumeTime > 0 ? payload.resumeTime : null;
        state.resumeTime = payload.resumeTime || 0;
        state.playlist = ads;
        state.currentIndex = safeIdx;
        renderCurrentAd();
        return;
      }

      if (state.isPaused) {
        state.isPaused = false;
        els.pausedBanner.classList.add("hidden");
        var targetResume =
          payload.resumeTime != null ? payload.resumeTime : state.resumeTime;
        state.pendingSeek = targetResume > 0 ? targetResume : null;
        if (activeAd && !isImageAd(activeAd)) {
          if (els.video.readyState >= 1) {
            if (seekVideoSafely(els.video, targetResume, 0.5)) {
              state.pendingSeek = null;
            }
          }
          safePlayVideo();
        } else {
          renderCurrentAd();
        }
        return;
      }

      state.isPaused = false;
      state.pendingSeek = payload.resumeTime > 0 ? payload.resumeTime : null;
      state.resumeTime = payload.resumeTime || 0;
      state.playlist = ads;
      state.currentIndex = safeIdx;
      renderCurrentAd();
    });

    socket.on("sync_seek", function (payload) {
      if (!payload || state.isPaused || state.emergencyAlert) return;
      var targetTime = payload.targetTime;
      if (!isFinite(targetTime) || targetTime < 0) return;

      if (
        typeof payload.adIndex === "number" &&
        payload.adIndex >= 0 &&
        payload.adIndex < state.playlist.length &&
        payload.adIndex !== state.currentIndex
      ) {
        state.pendingSeek = targetTime;
        state.resumeTime = targetTime;
        state.currentIndex = payload.adIndex;
        renderCurrentAd();
        return;
      }

      var activeAd = state.playlist[state.currentIndex];
      if (!activeAd || activeAd.videoPath !== payload.videoPath) return;

      state.pendingSeek = targetTime;
      if (els.video.readyState >= 1) {
        if (seekVideoSafely(els.video, targetTime, 0.75)) {
          state.pendingSeek = null;
        }
      }
    });

    socket.on("pause_ads", function () {
      state.pendingSeek = null;
      state.isPaused = true;
      state.resumeTime = els.video.currentTime || 0;
      els.video.pause();
      clearTimers();
      els.pausedBanner.classList.remove("hidden");
      emitPlayingVideo("PAUSED", state.resumeTime);
    });

    socket.on("stop_ads", function () {
      state.isPaused = false;
      state.pendingSeek = null;
      state.resumeTime = 0;
      state.playlist = [];
      state.currentIndex = 0;
      clearTimers();
      els.pausedBanner.classList.add("hidden");
      renderCurrentAd();
      emitPlayingVideo(null, 0);
    });

    socket.on("screen_settings_update", function (next) {
      if (!next) return;
      state.settings = {
        volume: next.volume != null ? next.volume : 100,
        muted: Boolean(next.muted),
        orientation: String(next.orientation || "0"),
      };
      updateStageOrientation();
      applyAudioSettings();
    });

    socket.on("device_command", function (payload) {
      var cmd = payload && payload.command;
      if (cmd === "reload") {
        window.location.reload();
      } else if (cmd === "clear_cache") {
        clearOfflineCache(state.screenToken);
        window.location.reload();
      }
    });

    socket.on("emergency_override", function (alert) {
      if (state.emergencyTimer) {
        clearTimeout(state.emergencyTimer);
        state.emergencyTimer = null;
      }
      if (!alert || alert.active === false) {
        state.emergencyAlert = null;
        els.emergencyLayer.classList.add("hidden");
        if (!state.isPaused && state.playlist.length) {
          renderCurrentAd();
        }
        return;
      }

      state.emergencyAlert = alert;
      els.video.pause();
      clearTimers();
      els.emergencyTitle.textContent = alert.title || "URGENT ANNOUNCEMENT";
      els.emergencyMessage.textContent = alert.message || "";
      els.emergencyLayer.style.backgroundColor =
        alert.backgroundColor || "#dc2626";
      els.emergencyLayer.classList.remove("hidden");

      if (alert.durationSeconds > 0) {
        state.emergencyTimer = setTimeout(function () {
          state.emergencyAlert = null;
          els.emergencyLayer.classList.add("hidden");
          if (!state.isPaused && state.playlist.length) {
            renderCurrentAd();
          }
        }, alert.durationSeconds * 1000);
      }
    });

    state.heartbeatTimer = setInterval(function () {
      if (!state.socket || !state.deviceId) return;
      var ad = state.playlist[state.currentIndex];
      if (!ad || state.isPaused || state.emergencyAlert) return;

      if (isImageAd(ad)) {
        emitPlayingVideo(ad.videoPath, 0);
      } else if (!els.video.paused) {
        emitPlayingVideo(ad.videoPath, els.video.currentTime || 0);
      }
    }, 5000);
  }

  function startPairedMode() {
    clearPairTimer();
    showLayer("waiting");
    setConnStatus("warn", "Connecting");
    els.waitingSubtitle.textContent = "Connecting to server…";
    updateInfoDisplay();

    fetch(state.serverUrl + "/api/devices/by-token/" + encodeURIComponent(state.screenToken))
      .then(function (res) {
        if (!res.ok) throw new Error("Device lookup failed (" + res.status + ")");
        return res.json();
      })
      .then(function (json) {
        var device = json && json.data;
        if (!device) throw new Error("Device not found for this token");

        setOfflineBadge(false);
        state.deviceId = device.deviceId;
        state.locationId =
          device.location_id && device.location_id[0]
            ? device.location_id[0]._id
            : null;
        if (device.settings) {
          state.settings = {
            volume: device.settings.volume != null ? device.settings.volume : 100,
            muted: Boolean(device.settings.muted),
            orientation: String(device.settings.orientation || "0"),
          };
          updateStageOrientation();
        }
        els.waitingSubtitle.textContent =
          "Waiting for content from the Admin Panel…";
        updateInfoDisplay();
        connectDeviceSocket();
      })
      .catch(function (err) {
        var cached = loadOfflinePlaylist(state.screenToken);
        if (cached && cached.ads && cached.ads.length) {
          setOfflineBadge(true);
          setConnStatus("err", "Offline");
          state.deviceId = cached.deviceId || null;
          state.locationId = cached.locationId || null;
          state.playlist = cached.ads;
          state.currentIndex = 0;
          updateInfoDisplay();
          renderCurrentAd();
          if (state.deviceId) connectDeviceSocket();
        } else {
          setConnStatus("err", "Offline");
          els.waitingSubtitle.textContent =
            "Can't reach the server (" +
            (err && err.message ? err.message : "network error") +
            "). Open Settings to check the server URL.";
        }
      });
  }

  function startPairingMode() {
    disconnectSockets();
    state.deviceId = null;
    state.locationId = null;
    state.playlist = [];
    showLayer("pairing");
    setConnStatus("warn", "Connecting");
    updateInfoDisplay();

    els.pairError.classList.add("hidden");
    renderPairCode("");
    els.pairStatus.textContent = "Requesting pairing code…";

    fetch(state.serverUrl + "/api/devices/pair/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            throw new Error(
              (data && data.message) || "HTTP " + res.status
            );
          }
          return data;
        });
      })
      .then(function (data) {
        state.pairingCode = data.code;
        renderPairCode(data.code);
        setConnStatus("ok", "Online");
        startPairCountdown(data.expiresAt);

        var sock = window.io(state.serverUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
        });
        state.pairSocket = sock;

        var joinPair = function () {
          setConnStatus("ok", "Online");
          sock.emit("join_pairing_code", state.pairingCode);
        };
        sock.on("connect", joinPair);
        if (sock.connected) joinPair();
        sock.on("disconnect", function () {
          setConnStatus("err", "Offline");
        });

        sock.on("device_paired", function (ev) {
          if (ev && ev.screenToken) {
            try {
              localStorage.setItem(STORAGE_TOKEN_KEY, ev.screenToken);
            } catch (_) {}
            state.screenToken = ev.screenToken;
            startPairedMode();
          }
        });
      })
      .catch(function (err) {
        renderPairCode("");
        els.pairCode.className = "code-digits";
        setConnStatus("err", "Offline");
        els.pairError.textContent =
          "Can't reach " +
          state.serverUrl +
          " (" +
          (err && err.message ? err.message : "network error") +
          "). Tap Server settings and enter the correct URL.";
        els.pairError.classList.remove("hidden");
        els.pairStatus.textContent = "";
      });
  }

  /* ==================== TECHNICIAN SETTINGS OVERLAY ==================== */
  function openSettings() {
    els.inputServerUrl.value = state.serverUrl;
    els.settingsFeedback.classList.add("hidden");
    updateInfoDisplay();
    els.settingsLayer.classList.remove("hidden");
    setTimeout(function () {
      els.btnCloseSettings.focus();
    }, 30);
  }

  function closeSettings() {
    els.settingsLayer.classList.add("hidden");
  }

  function toggleSettings() {
    if (els.settingsLayer.classList.contains("hidden")) {
      openSettings();
    } else {
      closeSettings();
    }
  }

  window.JTSSignageToggleSettings = toggleSettings;

  function showSettingsFeedback(msg, isError) {
    els.settingsFeedback.textContent = msg;
    els.settingsFeedback.style.borderColor = isError
      ? "rgba(248, 113, 113, 0.5)"
      : "rgba(59, 130, 246, 0.45)";
    els.settingsFeedback.style.color = isError ? "#fecaca" : "#bfdbfe";
    els.settingsFeedback.classList.remove("hidden");
  }

  els.btnNewCode.addEventListener("click", startPairingMode);
  els.btnPairSettings.addEventListener("click", openSettings);
  els.btnWaitingSettings.addEventListener("click", openSettings);
  els.btnCloseSettings.addEventListener("click", closeSettings);

  els.btnSaveServer.addEventListener("click", function () {
    var nextUrl = normalizeServerUrl(els.inputServerUrl.value);
    state.serverUrl = nextUrl;
    try {
      localStorage.setItem(STORAGE_SERVER_KEY, nextUrl);
    } catch (_) {}
    closeSettings();
    if (state.screenToken) {
      startPairedMode();
    } else {
      startPairingMode();
    }
  });

  els.btnTestServer.addEventListener("click", function () {
    var testUrl = normalizeServerUrl(els.inputServerUrl.value);
    showSettingsFeedback("Testing " + testUrl + "...", false);
    fetch(testUrl + "/api/auth/setup-status")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        showSettingsFeedback("Server reachable (" + testUrl + ")", false);
      })
      .catch(function (err) {
        showSettingsFeedback(
          "Cannot reach server: " + (err && err.message ? err.message : "Error"),
          true
        );
      });
  });

  els.btnUnpair.addEventListener("click", function () {
    clearOfflineCache(state.screenToken);
    try {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
    } catch (_) {}
    state.screenToken = "";
    closeSettings();
    startPairingMode();
  });

  Array.prototype.slice
    .call(document.querySelectorAll(".preset-btn"))
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        els.inputServerUrl.value = btn.getAttribute("data-url") || "";
      });
    });

  // 5 quick taps on top-left corner opens Technician Settings
  var tapCount = 0;
  var tapTimer = null;
  els.hotspot.addEventListener("click", function () {
    tapCount++;
    clearTimeout(tapTimer);
    if (tapCount >= 5) {
      tapCount = 0;
      toggleSettings();
      return;
    }
    tapTimer = setTimeout(function () {
      tapCount = 0;
    }, 1500);
  });

  // Keyboard & TV Remote Menu / Ctrl+Shift+S / F9 shortcuts
  document.addEventListener("keydown", function (e) {
    if (
      (e.ctrlKey && e.shiftKey && (e.key === "S" || e.key === "s")) ||
      e.key === "F9" ||
      e.key === "ContextMenu" ||
      e.keyCode === 82 ||
      e.keyCode === 457
    ) {
      e.preventDefault();
      toggleSettings();
    } else if (e.key === "Escape" && !els.settingsLayer.classList.contains("hidden")) {
      e.preventDefault();
      closeSettings();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && state.socket && state.deviceId) {
      state.socket.emit("request_sync", { deviceId: state.deviceId });
      if (!state.isPaused && !state.emergencyAlert && state.playlist.length) {
        var ad = state.playlist[state.currentIndex];
        if (ad && !isImageAd(ad)) safePlayVideo();
      }
    }
  });

  // Auto-fullscreen on first remote click/keydown in standard TV browsers (Samsung/LG)
  if (
    typeof location !== "undefined" &&
    (location.protocol === "http:" || location.protocol === "https:")
  ) {
    var requestBrowserFullscreen = function () {
      try {
        var el = document.documentElement;
        if (!document.fullscreenElement && el && el.requestFullscreen) {
          el.requestFullscreen().catch(function () {});
        }
      } catch (_) {}
      document.removeEventListener("click", requestBrowserFullscreen);
      document.removeEventListener("keydown", requestBrowserFullscreen);
    };
    document.addEventListener("click", requestBrowserFullscreen);
    document.addEventListener("keydown", requestBrowserFullscreen);
  }

  /* ==================== BOOTSTRAP ==================== */
  requestPlatformWakeLock();
  if (state.screenToken) {
    startPairedMode();
  } else {
    startPairingMode();
  }
})();
