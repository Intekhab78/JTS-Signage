import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import { SOCKET_BASE_URL } from "../../config";
import { getMediaUrl } from "../../utils/mediaUrl";
import {
  cachePlaylistMedia,
  clearMediaCache,
  getCachedMediaUrl,
  loadOfflinePlaylist,
  saveOfflinePlaylist,
} from "../../utils/offlineCache";

const isImageAd = (ad) =>
  ad?.mediaType === "image" ||
  /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(ad?.videoPath || "");

export default function AdScreen() {
  const { token } = useParams();

  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const objectUrlRef = useRef(null);
  const playStartedAtRef = useRef(new Date().toISOString());
  const emergencyTimerRef = useRef(null);
  const emergencyAlertRef = useRef(null);
  const pendingSeekRef = useRef(null);

  const isPausedRef = useRef(false);
  const resumeTimeRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const playlistRef = useRef([]);

  const [DEVICE_ID, setDEVICE_ID] = useState(null);
  const [locationId, setLocationId] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState("");
  const [isMuted, setIsMuted] = useState(true);
  const [isPausedState, setIsPausedState] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [tokenError, setTokenError] = useState("");
  const [settings, setSettings] = useState({
    volume: 100,
    muted: false,
    orientation: "0",
  });
  const [emergencyAlert, setEmergencyAlert] = useState(null);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    emergencyAlertRef.current = emergencyAlert;
  }, [emergencyAlert]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  const seekVideoSafely = (video, rawTargetTime, thresholdSec = 0.75) => {
    if (!video || !Number.isFinite(rawTargetTime) || rawTargetTime < 0) {
      return false;
    }
    if (video.readyState < 1) return false;

    let target =
      Number.isFinite(video.duration) && video.duration > 0.5
        ? rawTargetTime % video.duration
        : rawTargetTime;

    if (video.seekable?.length > 0) {
      const minS = video.seekable.start(0);
      const maxS = video.seekable.end(video.seekable.length - 1);
      if (Number.isFinite(minS) && Number.isFinite(maxS) && maxS > minS) {
        target = Math.max(minS, Math.min(target, maxS));
      }
    }

    if (Math.abs(video.currentTime - target) > thresholdSec) {
      video.currentTime = target;
    }

    return Math.abs(video.currentTime - target) <= thresholdSec;
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (emergencyTimerRef.current) {
        clearTimeout(emergencyTimerRef.current);
      }
    };
  }, []);

  const applyVolumeToVideo = (video) => {
    if (!video) return;
    const s = settingsRef.current;
    const vol = Math.max(0, Math.min(1, (s.volume ?? 100) / 100));
    video.volume = vol;

    if (!audioUnlockedRef.current) {
      video.muted = true;
    } else {
      video.muted = Boolean(s.muted);
      setIsMuted(Boolean(s.muted));
    }
  };

  const safePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      applyVolumeToVideo(video);
      await video.play();
    } catch (e) {
      if (e?.name === "AbortError") {
        return;
      }
      if (e?.name === "NotAllowedError" && !video.muted) {
        audioUnlockedRef.current = false;
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {});
        return;
      }
      if (e?.name !== "NotAllowedError") {
        console.warn("Playback notice:", e?.message || e);
      }
    }
  };

  useEffect(() => {
    const enterFullscreenAndUnlock = (e) => {
      if (!e?.isTrusted) return;
      if (navigator.userActivation && !navigator.userActivation.isActive) {
        return;
      }

      const elem = document.documentElement;
      if (!document.fullscreenElement && elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      }

      audioUnlockedRef.current = true;
      const shouldMute = Boolean(settingsRef.current.muted);
      setIsMuted(shouldMute);

      if (videoRef.current) {
        videoRef.current.muted = shouldMute;
        videoRef.current.volume = Math.max(
          0,
          Math.min(1, (settingsRef.current.volume ?? 100) / 100)
        );
        if (
          videoRef.current.paused &&
          !isPausedRef.current &&
          !emergencyAlertRef.current
        ) {
          safePlay();
        }
      }

      document.removeEventListener("click", enterFullscreenAndUnlock);
      document.removeEventListener("touchstart", enterFullscreenAndUnlock);
    };

    document.addEventListener("click", enterFullscreenAndUnlock);
    document.addEventListener("touchstart", enterFullscreenAndUnlock);

    return () => {
      document.removeEventListener("click", enterFullscreenAndUnlock);
      document.removeEventListener("touchstart", enterFullscreenAndUnlock);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (socketRef.current && DEVICE_ID) {
          socketRef.current.emit("request_sync", { deviceId: DEVICE_ID });
        }
        if (
          videoRef.current &&
          !isPausedRef.current &&
          !emergencyAlertRef.current
        ) {
          safePlay();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [DEVICE_ID]);

  /* ================= LOAD DEVICE & OFFLINE FALLBACK ================= */
  useEffect(() => {
    if (!token) {
      setTokenError("Invalid screen URL: missing device token.");
      return;
    }

    setTokenError("");
    api
      .get(`/devices/by-token/${token}`)
      .then((res) => {
        const device = res.data.data;
        if (!device) {
          setTokenError("Device not found for this screen URL.");
          return;
        }

        const locId = device.location_id?.[0]?._id || null;
        setDEVICE_ID(device.deviceId);
        setLocationId(locId);

        try {
          localStorage.setItem("vms_saved_screen_token", token);
        } catch {
          // Ignore storage errors
        }

        if (device.settings) {
          setSettings({
            volume: device.settings.volume ?? 100,
            muted: Boolean(device.settings.muted),
            orientation: device.settings.orientation ?? "0",
          });
        }

        const cached = loadOfflinePlaylist(token);
        if (cached?.ads?.length) {
          saveOfflinePlaylist(token, {
            ...cached,
            deviceId: device.deviceId,
            locationId: locId,
          });
        }
      })
      .catch((err) => {
        console.error(err);
        if (err?.response?.status === 404) {
          try {
            localStorage.removeItem("vms_saved_screen_token");
          } catch {
            // Ignore
          }
          window.location.replace("/pair?rePair=1");
          return;
        }
        const cached = loadOfflinePlaylist(token);
        if (cached?.ads?.length) {
          setIsOnline(false);
          setDEVICE_ID(cached.deviceId || null);
          setLocationId(cached.locationId || null);
          setPlaylist(cached.ads);
          setCurrentIndex(0);
        } else {
          setTokenError(
            err?.response?.data?.message ||
              "Device not found or failed to load screen."
          );
        }
      });
  }, [token]);

  /* ================= SOCKET ================= */
  useEffect(() => {
    if (!DEVICE_ID) return;

    const socket = io(SOCKET_BASE_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected:", socket.id);
      setIsOnline(navigator.onLine);

      socket.emit("register_device", {
        deviceId: DEVICE_ID,
        locationId: locationId || null,
      });
    });

    socket.on("disconnect", () => {
      setIsOnline(false);
    });

    /* ===== PLAY ===== */
    socket.on(
      "play_ads",
      ({ ads, deviceId, startPaused, resumeTime, startIndex }) => {
        if (deviceId !== DEVICE_ID) return;
        if (!Array.isArray(ads) || ads.length === 0) return;

        const incomingSig = ads.map((a) => String(a._id)).join(",");
        const currentSig = playlistRef.current
          .map((a) => String(a._id))
          .join(",");
        const activeAdNow = playlistRef.current[currentIndexRef.current];
        const isVideoCurrentlyPlaying =
          videoRef.current &&
          !videoRef.current.paused &&
          !videoRef.current.ended &&
          videoRef.current.readyState >= 2;

        if (
          !startPaused &&
          !isPausedRef.current &&
          incomingSig === currentSig &&
          playlistRef.current.length > 0 &&
          (resumeTime == null || resumeTime === 0) &&
          (isVideoCurrentlyPlaying || (activeAdNow && isImageAd(activeAdNow)))
        ) {
          return;
        }

        const safeIndex =
          Number.isInteger(startIndex) &&
          startIndex >= 0 &&
          startIndex < ads.length
            ? startIndex
            : 0;

        // Cache media & playlist for offline playback
        cachePlaylistMedia(ads.map((a) => getMediaUrl(a.videoPath)));
        saveOfflinePlaylist(token, { deviceId: DEVICE_ID, locationId, ads });

        if (startPaused) {
          isPausedRef.current = true;
          setIsPausedState(true);
          pendingSeekRef.current = resumeTime > 0 ? resumeTime : null;
          resumeTimeRef.current = resumeTime || 0;
          setPlaylist(ads);
          setCurrentIndex(safeIndex);
          return;
        }

        if (isPausedRef.current) {
          isPausedRef.current = false;
          setIsPausedState(false);

          const targetResume =
            resumeTime != null ? resumeTime : resumeTimeRef.current;
          pendingSeekRef.current = targetResume > 0 ? targetResume : null;

          if (videoRef.current) {
            if (videoRef.current.readyState >= 1) {
              if (seekVideoSafely(videoRef.current, targetResume, 0.5)) {
                pendingSeekRef.current = null;
              }
            }
            safePlay();
          }

          const activeAd =
            playlistRef.current[currentIndexRef.current] || ads[safeIndex];
          if (socketRef.current && activeAd) {
            socketRef.current.emit("playing_video", {
              deviceId: DEVICE_ID,
              videoPath: activeAd.videoPath,
              currentTime: targetResume,
            });
          }

          return;
        }

        isPausedRef.current = false;
        setIsPausedState(false);
        pendingSeekRef.current = resumeTime > 0 ? resumeTime : null;
        resumeTimeRef.current = resumeTime || 0;
        playStartedAtRef.current = new Date().toISOString();

        setPlaylist(ads);
        setCurrentIndex(safeIndex);
      }
    );

    /* ===== PAUSE ===== */
    socket.on("pause_ads", () => {
      pendingSeekRef.current = null;
      if (videoRef.current) {
        resumeTimeRef.current = videoRef.current.currentTime;
        videoRef.current.pause();
      }

      isPausedRef.current = true;
      setIsPausedState(true);

      socketRef.current?.emit("playing_video", {
        deviceId: DEVICE_ID,
        videoPath: "PAUSED",
        currentTime: resumeTimeRef.current,
      });
    });

    /* ===== STOP ===== */
    socket.on("stop_ads", () => {
      isPausedRef.current = false;
      setIsPausedState(false);
      pendingSeekRef.current = null;
      resumeTimeRef.current = 0;

      if (videoRef.current) {
        videoRef.current.pause();
        delete videoRef.current.dataset.mediaSrc;
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }

      setPlaylist([]);
      setCurrentIndex(0);

      socketRef.current?.emit("playing_video", {
        deviceId: DEVICE_ID,
        videoPath: null,
        currentTime: 0,
      });
    });

    /* ===== DRIFT CORRECTION SYNC ===== */
    socket.on("sync_seek", ({ videoPath, targetTime, adIndex }) => {
      if (isPausedRef.current || emergencyAlertRef.current) return;
      if (!Number.isFinite(targetTime) || targetTime < 0) return;

      if (
        Number.isInteger(adIndex) &&
        adIndex >= 0 &&
        adIndex < playlistRef.current.length &&
        adIndex !== currentIndexRef.current
      ) {
        pendingSeekRef.current = targetTime;
        resumeTimeRef.current = targetTime;
        setCurrentIndex(adIndex);
        return;
      }

      const activeAd = playlistRef.current[currentIndexRef.current];
      if (!activeAd || activeAd.videoPath !== videoPath) return;

      pendingSeekRef.current = targetTime;
      const video = videoRef.current;
      if (video && video.readyState >= 1) {
        const aligned = seekVideoSafely(video, targetTime, 0.75);
        if (aligned) {
          pendingSeekRef.current = null;
        }
      }
    });

    /* ===== SCREEN SETTINGS ===== */
    socket.on("screen_settings_update", (nextSettings) => {
      if (!nextSettings) return;
      const merged = {
        volume: nextSettings.volume ?? 100,
        muted: Boolean(nextSettings.muted),
        orientation: nextSettings.orientation ?? "0",
      };
      setSettings(merged);
      settingsRef.current = merged;

      if (videoRef.current) {
        videoRef.current.volume = Math.max(0, Math.min(1, merged.volume / 100));
        if (audioUnlockedRef.current) {
          videoRef.current.muted = merged.muted;
          setIsMuted(merged.muted);
        }
      }
    });

    /* ===== REMOTE COMMANDS ===== */
    socket.on("device_command", async ({ command }) => {
      if (command === "reload") {
        window.location.reload();
      } else if (command === "clear_cache") {
        await clearMediaCache(token);
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "CLEAR_MEDIA_CACHE",
          });
        }
        window.location.reload();
      }
    });

    /* ===== EMERGENCY OVERRIDE ===== */
    socket.on("emergency_override", (alert) => {
      if (emergencyTimerRef.current) {
        clearTimeout(emergencyTimerRef.current);
        emergencyTimerRef.current = null;
      }

      if (!alert || alert.active === false) {
        setEmergencyAlert(null);
        if (videoRef.current && !isPausedRef.current) {
          safePlay();
        }
        return;
      }

      setEmergencyAlert(alert);
      if (videoRef.current) {
        videoRef.current.pause();
      }

      if (alert.durationSeconds > 0) {
        emergencyTimerRef.current = setTimeout(() => {
          setEmergencyAlert(null);
          if (videoRef.current && !isPausedRef.current) {
            safePlay();
          }
        }, alert.durationSeconds * 1000);
      }
    });

    return () => socket.disconnect();
  }, [DEVICE_ID, locationId, token]);

  /* ================= PERIODIC HEARTBEAT (5s) ================= */
  useEffect(() => {
    const interval = setInterval(() => {
      if (!socketRef.current || !DEVICE_ID) return;
      const currentAd = playlist[currentIndex];
      if (!currentAd || isPausedRef.current || emergencyAlert) return;

      if (isImageAd(currentAd)) {
        socketRef.current.emit("playing_video", {
          deviceId: DEVICE_ID,
          videoPath: currentAd.videoPath,
          currentTime: 0,
        });
      } else if (videoRef.current && !videoRef.current.paused) {
        socketRef.current.emit("playing_video", {
          deviceId: DEVICE_ID,
          videoPath: currentAd.videoPath,
          currentTime: videoRef.current.currentTime,
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [DEVICE_ID, playlist, currentIndex, emergencyAlert]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const preventAutoPlay = () => {
      if (isPausedRef.current || emergencyAlert) {
        video.pause();
      }
    };

    video.addEventListener("play", preventAutoPlay);

    return () => {
      video.removeEventListener("play", preventAutoPlay);
    };
  }, [playlist.length, emergencyAlert]);

  const emitAdPlayed = (ad, durationSec) => {
    if (!socketRef.current || !DEVICE_ID || !ad) return;
    socketRef.current.emit("ad_played", {
      deviceId: DEVICE_ID,
      advertisementId: ad._id,
      adTitle: ad.title,
      mediaType: isImageAd(ad) ? "image" : "video",
      durationSeconds: Math.max(0, Math.round(durationSec || 0)),
      startedAt: playStartedAtRef.current,
      endedAt: new Date().toISOString(),
    });
  };

  /* ================= RESOLVE CACHED/REMOTE MEDIA URL ================= */
  const currentAd = playlist[currentIndex] || null;

  useEffect(() => {
    let cancelled = false;

    const loadMedia = async () => {
      if (!currentAd?.videoPath) {
        setResolvedMediaUrl("");
        return;
      }

      const rawUrl = getMediaUrl(currentAd.videoPath);
      const { url, isObjectUrl } = await getCachedMediaUrl(rawUrl);

      if (cancelled) {
        if (isObjectUrl) URL.revokeObjectURL(url);
        return;
      }

      if (objectUrlRef.current && objectUrlRef.current !== url) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = isObjectUrl ? url : null;
      playStartedAtRef.current = new Date().toISOString();
      setResolvedMediaUrl(url);
    };

    loadMedia();

    return () => {
      cancelled = true;
    };
  }, [currentAd?._id, currentAd?.videoPath, currentIndex]);

  /* ================= VIDEO LOAD & PLAY ================= */
  useEffect(() => {
    if (!currentAd || isImageAd(currentAd) || !resolvedMediaUrl) return;
    const video = videoRef.current;
    if (!video) return;

    if (video.dataset.mediaSrc !== resolvedMediaUrl) {
      if (pendingSeekRef.current == null && resumeTimeRef.current > 0) {
        pendingSeekRef.current = resumeTimeRef.current;
      }
      resumeTimeRef.current = 0;

      video.pause();
      video.removeAttribute("src");
      video.dataset.mediaSrc = resolvedMediaUrl;
      video.src = resolvedMediaUrl;
      video.load();

      if (video.readyState >= 1) {
        if (pendingSeekRef.current != null) {
          const aligned = seekVideoSafely(video, pendingSeekRef.current, 0.5);
          if (aligned) pendingSeekRef.current = null;
        }
        if (!isPausedRef.current && !emergencyAlertRef.current) {
          safePlay();
        }
      }
    }
  }, [resolvedMediaUrl, currentAd?._id, currentAd?.videoPath, currentIndex]);

  /* ================= IMAGE TIMER & PROOF-OF-PLAY ================= */
  useEffect(() => {
    if (!currentAd || !isImageAd(currentAd)) return;
    if (isPausedState || emergencyAlert) return;

    if (socketRef.current && DEVICE_ID) {
      socketRef.current.emit("playing_video", {
        deviceId: DEVICE_ID,
        videoPath: currentAd.videoPath,
        currentTime: 0,
      });
    }

    const durationSec = Math.max(1, Number(currentAd.displayDuration) || 10);
    const timer = setTimeout(() => {
      emitAdPlayed(currentAd, durationSec);
      playStartedAtRef.current = new Date().toISOString();
      if (playlist.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % playlist.length);
      }
    }, durationSec * 1000);

    return () => clearTimeout(timer);
  }, [
    currentAd,
    currentIndex,
    playlist.length,
    isPausedState,
    emergencyAlert,
    DEVICE_ID,
  ]);

  /* ================= ORIENTATION STYLE ================= */
  const orientation = settings.orientation || "0";
  const isSideways = orientation === "90" || orientation === "270";
  const containerStyle = isSideways
    ? {
        width: "100vh",
        height: "100vw",
        transform: `translate(-50%, -50%) rotate(${orientation}deg)`,
        position: "absolute",
        top: "50%",
        left: "50%",
      }
    : {
        width: "100%",
        height: "100%",
        transform: orientation === "180" ? "rotate(180deg)" : undefined,
      };

  const tickerText =
    currentAd?.tickerText ||
    currentAd?.title ||
    "Welcome to JTS Signage";

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <div style={containerStyle} className="relative bg-black">
        {tokenError ? (
          <div className="flex items-center justify-center h-full text-red-400 text-xl px-6 text-center">
            {tokenError}
          </div>
        ) : playlist.length && currentAd ? (
          <>
            {isImageAd(currentAd) ? (
              <img
                src={resolvedMediaUrl}
                alt={currentAd.title || "Advertisement"}
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted={isMuted}
                playsInline
                controls={false}
                disablePictureInPicture
                preload="auto"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (pendingSeekRef.current != null) {
                    seekVideoSafely(v, pendingSeekRef.current, 0.5);
                  }
                  if (!isPausedRef.current && !emergencyAlertRef.current) {
                    safePlay();
                  }
                }}
                onCanPlay={(e) => {
                  const v = e.currentTarget;
                  if (pendingSeekRef.current != null) {
                    const aligned = seekVideoSafely(
                      v,
                      pendingSeekRef.current,
                      0.5
                    );
                    if (aligned) pendingSeekRef.current = null;
                  }
                  if (
                    v.paused &&
                    !isPausedRef.current &&
                    !emergencyAlertRef.current
                  ) {
                    safePlay();
                  }
                }}
                onPlay={() => {
                  if (socketRef.current && DEVICE_ID && currentAd) {
                    socketRef.current.emit("playing_video", {
                      deviceId: DEVICE_ID,
                      videoPath: currentAd.videoPath,
                      currentTime: videoRef.current?.currentTime || 0,
                    });
                  }
                }}
                onEnded={() => {
                  pendingSeekRef.current = null;
                  const dur = videoRef.current?.duration || 0;
                  emitAdPlayed(currentAd, dur);
                  playStartedAtRef.current = new Date().toISOString();

                  if (playlist.length > 1) {
                    setCurrentIndex((prev) => (prev + 1) % playlist.length);
                  } else if (videoRef.current && !isPausedRef.current) {
                    videoRef.current.currentTime = 0;
                    safePlay();
                  }
                }}
              />
            )}

            {!isOnline && (
              <div className="absolute top-4 left-4 bg-amber-600/85 text-white text-xs sm:text-sm px-3 py-1.5 rounded-full pointer-events-none">
                Offline Mode (Cached)
              </div>
            )}

            {!isImageAd(currentAd) && isMuted && !settings.muted && (
              <div className="absolute top-4 right-4 bg-black/60 text-white text-xs sm:text-sm px-3 py-1.5 rounded-full pointer-events-none">
                Click / Tap anywhere to unmute
              </div>
            )}

            {/* Ticker */}
            <div className="absolute bottom-4 left-0 w-full bg-black/50 py-2 overflow-hidden">
              <div className="ticker text-white text-lg font-semibold">
                {tickerText}
              </div>
            </div>

            <style>
              {`
                .ticker {
                  white-space: nowrap;
                  display: inline-block;
                  padding-left: 100%;
                  animation: tickerMove 15s linear infinite;
                }

                @keyframes tickerMove {
                  0% { transform: translateX(0%); }
                  100% { transform: translateX(-100%); }
                }
              `}
            </style>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-white text-xl">
            Waiting for advertisement…
          </div>
        )}

        {/* Emergency Announcement Overlay */}
        {emergencyAlert?.active && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white p-8 text-center"
            style={{
              backgroundColor: emergencyAlert.backgroundColor || "#dc2626",
            }}
          >
            <div className="max-w-4xl space-y-6">
              <div className="inline-block px-4 py-1 bg-white/20 rounded-full text-sm font-bold tracking-widest uppercase">
                Urgent Broadcast
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold">
                {emergencyAlert.title || "URGENT ANNOUNCEMENT"}
              </h1>
              <p className="text-xl sm:text-3xl font-medium leading-relaxed">
                {emergencyAlert.message}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
