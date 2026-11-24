import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaBroadcastTower,
  FaBullhorn,
  FaLayerGroup,
  FaPause,
  FaPlay,
  FaStop,
  FaSyncAlt,
  FaTimesCircle,
  FaTv,
} from "react-icons/fa";
import { io } from "socket.io-client";
import api from "../api/axios";
import ActionIconButton from "../components/ActionIconButton";
import Pagination from "../components/Pagination";
import { SOCKET_BASE_URL } from "../config";
import { useToast } from "../context/ToastContext";
import { getMediaUrl } from "../utils/mediaUrl";
import { getCompanies } from "./services/company.api";
import { getLocationsByCompany } from "./services/location.api";

const isImagePath = (path) =>
  /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(path || "");

const formatClock = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const LABEL_CLS =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-600 mb-0.5";
const CONTROL_CLS =
  "w-full h-[36px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function LiveScreens() {
  const toast = useToast();
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;
  const [controllingDevice, setControllingDevice] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const videoRefs = useRef({});
  const latestSyncRef = useRef({});

  // Bulk Control State
  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Emergency Override State
  const [emergencyTitle, setEmergencyTitle] = useState("URGENT ANNOUNCEMENT");
  const [emergencyMessage, setEmergencyMessage] = useState("");
  const [emergencyDuration, setEmergencyDuration] = useState(60);
  const [emergencyBusy, setEmergencyBusy] = useState(false);

  useEffect(() => {
    const ticker = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const applyScreensSnapshot = useCallback((list) => {
    const receivedAt = Date.now();
    const nextMap = {};
    (list || []).forEach((s) => {
      nextMap[s.deviceId] = {
        currentTime: Number(s.currentTime) || 0,
        receivedAt,
        currentVideo: s.currentVideo || null,
      };
    });
    latestSyncRef.current = nextMap;
    setScreens(list || []);
  }, []);

  const getLiveTarget = useCallback((deviceId) => {
    const entry = latestSyncRef.current[deviceId];
    if (!entry) return null;
    if (!entry.currentVideo || entry.currentVideo === "PAUSED") {
      return entry.currentTime;
    }
    return (
      entry.currentTime + Math.max(0, (Date.now() - entry.receivedAt) / 1000)
    );
  }, []);

  const syncVideoElement = useCallback(
    (deviceId, video, thresholdSec = 0.8) => {
      if (!video || video.readyState < 1) return false;
      const rawTarget = getLiveTarget(deviceId);
      if (rawTarget === null || !Number.isFinite(rawTarget)) return false;

      let target =
        Number.isFinite(video.duration) && video.duration > 0.5
          ? rawTarget % video.duration
          : rawTarget;

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
    },
    [getLiveTarget]
  );

  const refreshLive = useCallback(async () => {
    try {
      const res = await api.get("/admin/live-screens");
      applyScreensSnapshot(res.data.data || []);
    } catch (err) {
      console.error("Live screens error:", err);
    }
  }, [applyScreensSnapshot]);

  useEffect(() => {
    Promise.all([api.get("/admin/live-screens"), getCompanies()])
      .then(([liveRes, compRes]) => {
        applyScreensSnapshot(liveRes.data.data || []);
        setCompanies(compRes.data.data || []);
      })
      .catch((err) => console.error("Live screens error:", err))
      .finally(() => setLoading(false));

    const socket = io(SOCKET_BASE_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    const joinMonitors = () => {
      const token = localStorage.getItem("token");
      if (token) {
        socket.emit("join_admin_monitors", token);
      }
    };

    socket.on("connect", joinMonitors);
    if (socket.connected) joinMonitors();

    socket.on("live_screens_update", (data) => {
      applyScreensSnapshot(data || []);
    });

    return () => socket.disconnect();
  }, [applyScreensSnapshot]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setLocations([]);
      setSelectedLocationId("");
      return;
    }
    getLocationsByCompany(selectedCompanyId)
      .then((res) => setLocations(res.data.data || []))
      .catch(() => {});
  }, [selectedCompanyId]);

  const totalPages = Math.max(1, Math.ceil(screens.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginatedScreens = useMemo(() => {
    return screens.slice(
      (safePage - 1) * itemsPerPage,
      safePage * itemsPerPage
    );
  }, [screens, safePage]);

  useEffect(() => {
    paginatedScreens.forEach((screen) => {
      if (
        !screen.currentVideo ||
        screen.currentVideo === "PAUSED" ||
        isImagePath(screen.currentVideo)
      ) {
        return;
      }
      const video = videoRefs.current[screen.deviceId];
      if (!video) return;

      const targetSrc = getMediaUrl(screen.currentVideo);
      if (video.dataset.mediaSrc !== targetSrc) {
        video.dataset.mediaSrc = targetSrc;
        video.src = targetSrc;
        return;
      }

      if (video.readyState >= 1) {
        syncVideoElement(screen.deviceId, video, 0.8);
        if (video.paused) {
          video.play().catch(() => {});
        }
      }
    });
  }, [paginatedScreens, syncVideoElement]);

  const counts = useMemo(
    () => ({
      online: screens.length,
      playing: screens.filter(
        (s) => s.currentVideo && s.currentVideo !== "PAUSED"
      ).length,
      paused: screens.filter((s) => s.currentVideo === "PAUSED").length,
    }),
    [screens]
  );

  const handleBulkAction = async (action) => {
    if (!selectedCompanyId && !selectedLocationId) {
      toast.error("Select a company or location first");
      return;
    }
    setBulkBusy(true);

    try {
      if (action === "play") {
        if (selectedLocationId) {
          await api.post("/advertisement/play-location", {
            companyId: selectedCompanyId || undefined,
            locationId: selectedLocationId,
          });
        } else {
          await api.post("/advertisement/play-company", {
            companyId: selectedCompanyId,
          });
        }
        toast.success("Bulk Play triggered");
      } else if (action === "pause") {
        await api.post("/advertisement/pause-bulk", {
          companyId: selectedCompanyId || undefined,
          locationId: selectedLocationId || undefined,
        });
        toast.success("Bulk Pause triggered");
      } else if (action === "stop") {
        await api.post("/advertisement/stop-bulk", {
          companyId: selectedCompanyId || undefined,
          locationId: selectedLocationId || undefined,
        });
        toast.success("Bulk Stop triggered");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleEmergencyBroadcast = async (active) => {
    if (active && !emergencyMessage.trim()) {
      toast.error("Enter an emergency announcement message");
      return;
    }

    setEmergencyBusy(true);
    try {
      const res = await api.post("/advertisement/emergency-override", {
        active,
        companyId: selectedCompanyId || undefined,
        locationId: selectedLocationId || undefined,
        title: emergencyTitle,
        message: emergencyMessage,
        durationSeconds: Number(emergencyDuration) || 0,
      });
      toast.success(
        res.data.message ||
          (active ? "Emergency alert sent" : "Emergency alert cleared")
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Emergency action failed");
    } finally {
      setEmergencyBusy(false);
    }
  };

  const handleSingleControl = async (screen, action) => {
    setControllingDevice(screen.deviceId);
    try {
      await api.post(`/advertisement/${action}`, {
        companyId: screen.companyId || undefined,
        locationId: screen.locationId || undefined,
        deviceId: screen.deviceId,
      });
      toast.success(
        `${action.charAt(0).toUpperCase() + action.slice(1)} sent to ${
          screen.deviceId
        }`
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.message || `Failed to ${action} ${screen.deviceId}`
      );
    } finally {
      setControllingDevice(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-4 space-y-4">
        <div className="h-28 bg-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-60 bg-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-4 min-h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <FaBroadcastTower />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              Live Screens Console
            </h1>
            <p className="text-xs text-slate-500">
              Monitor active TVs in real time, control fleet playback, and push
              emergency broadcasts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {counts.online} Online
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            {counts.playing} Playing
          </span>
          {counts.paused > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              {counts.paused} Paused
            </span>
          )}
          <ActionIconButton
            icon={FaSyncAlt}
            title="Refresh Live Screens"
            variant="slate"
            size="md"
            onClick={refreshLive}
          />
        </div>
      </div>

      {/* 2-Column Command Deck */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Bulk Fleet Control */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 text-xs">
                <FaLayerGroup />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  Bulk Fleet Control
                </h2>
                <p className="text-[11px] text-slate-500 truncate">
                  Control all screens across a company or specific location
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <ActionIconButton
                icon={FaPlay}
                title="Play All in Selection"
                variant="blue"
                size="sm"
                disabled={bulkBusy}
                onClick={() => handleBulkAction("play")}
              />
              <ActionIconButton
                icon={FaPause}
                title="Pause All in Selection"
                variant="amber"
                size="sm"
                disabled={bulkBusy}
                onClick={() => handleBulkAction("pause")}
              />
              <ActionIconButton
                icon={FaStop}
                title="Stop All in Selection"
                variant="red"
                size="sm"
                disabled={bulkBusy}
                onClick={() => handleBulkAction("stop")}
              />
            </div>
          </div>

          <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className={LABEL_CLS}>Target Company</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className={CONTROL_CLS}
              >
                <option value="">Select Company</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLS}>Target Location</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                disabled={!selectedCompanyId}
                className={`${CONTROL_CLS} disabled:bg-slate-100 disabled:text-slate-400`}
              >
                <option value="">All Locations in Company</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Emergency Override Panel */}
        <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-red-50/80 border-b border-red-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-600 border border-red-200 flex items-center justify-center shrink-0 text-xs">
                <FaBullhorn />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-red-900 truncate">
                  Emergency Announcement Override
                </h2>
                <p className="text-[11px] text-red-700 truncate">
                  Targets selected Company/Location (or all active TVs if blank)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <ActionIconButton
                icon={FaBullhorn}
                title="Broadcast Emergency Alert"
                variant="red"
                size="sm"
                disabled={emergencyBusy}
                onClick={() => handleEmergencyBroadcast(true)}
              />
              <ActionIconButton
                icon={FaTimesCircle}
                title="Clear Emergency Alert"
                variant="slate"
                size="sm"
                disabled={emergencyBusy}
                onClick={() => handleEmergencyBroadcast(false)}
              />
            </div>
          </div>

          <div className="p-3.5 bg-red-50/25 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-red-800 mb-0.5">
                Alert Title
              </label>
              <input
                type="text"
                value={emergencyTitle}
                onChange={(e) => setEmergencyTitle(e.target.value)}
                placeholder="URGENT ANNOUNCEMENT"
                className="w-full h-[36px] border border-red-200 rounded-lg px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-red-800 mb-0.5">
                Announcement Message
              </label>
              <input
                type="text"
                value={emergencyMessage}
                onChange={(e) => setEmergencyMessage(e.target.value)}
                placeholder="Enter urgent message for TVs..."
                className="w-full h-[36px] border border-red-200 rounded-lg px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-red-800 mb-0.5">
                Sec (0=Stay)
              </label>
              <input
                type="number"
                min="0"
                value={emergencyDuration}
                onChange={(e) => setEmergencyDuration(e.target.value)}
                title="Duration in seconds (0 = stay until cleared)"
                className="w-full h-[36px] border border-red-200 rounded-lg px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Screens Grid */}
      {screens.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center space-y-2">
          <span className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 inline-flex items-center justify-center">
            <FaTv className="text-lg" />
          </span>
          <p className="text-sm font-medium text-slate-600">
            No live screens currently connected.
          </p>
          <p className="text-xs text-slate-400">
            Open a device Screen URL or pair a TV via /pair to monitor live
            playback here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedScreens.map((screen) => {
            const isPaused = screen.currentVideo === "PAUSED";
            const isPlaying = Boolean(screen.currentVideo && !isPaused);

            const badge = isPaused
              ? { label: "Paused", cls: "bg-amber-100 text-amber-800 border-amber-200" }
              : isPlaying
                ? {
                    label: "Live",
                    cls: "bg-emerald-500/90 text-white border-emerald-400",
                  }
                : { label: "Idle", cls: "bg-slate-800/80 text-slate-200 border-slate-700" };

            return (
              <div
                key={screen.deviceId}
                className="border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition bg-white overflow-hidden flex flex-col"
              >
                <div className="relative aspect-video bg-slate-950">
                  {isPaused ? (
                    <div className="w-full h-full bg-amber-500/90 flex items-center justify-center text-white font-bold text-sm gap-2">
                      <FaPause /> Paused
                    </div>
                  ) : screen.currentVideo && isImagePath(screen.currentVideo) ? (
                    <img
                      src={getMediaUrl(screen.currentVideo)}
                      alt={screen.deviceId}
                      className="w-full h-full object-contain"
                    />
                  ) : screen.currentVideo ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoRefs.current[screen.deviceId] = el;
                        } else {
                          delete videoRefs.current[screen.deviceId];
                        }
                      }}
                      className="w-full h-full object-contain"
                      controls
                      muted
                      playsInline
                      preload="auto"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        syncVideoElement(screen.deviceId, v, 0.5);
                      }}
                      onCanPlay={(e) => {
                        const v = e.currentTarget;
                        syncVideoElement(screen.deviceId, v, 0.5);
                        if (v.paused) {
                          v.play().catch(() => {});
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5">
                      <FaTv className="text-xl text-slate-600" />
                      <span>Waiting for advertisement…</span>
                    </div>
                  )}

                  <span
                    className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border backdrop-blur-sm ${badge.cls}`}
                  >
                    {isPlaying && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                    {badge.label}
                  </span>

                  {isPlaying &&
                    !isImagePath(screen.currentVideo) &&
                    (() => {
                      const rawSec =
                        getLiveTarget(screen.deviceId) ?? screen.currentTime;
                      const dur = videoRefs.current[screen.deviceId]?.duration;
                      const displaySec =
                        Number.isFinite(dur) && dur > 0.5
                          ? rawSec % dur
                          : rawSec;
                      return (
                        <span
                          data-tick={nowTick}
                          className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/65 text-white font-mono text-[11px] backdrop-blur-sm"
                        >
                          {formatClock(displaySec)}
                        </span>
                      );
                    })()}
                </div>

                <div className="p-3.5 flex items-center justify-between gap-2.5 border-t border-slate-100 bg-white">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">
                      {screen.companyName || "Unknown Company"}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {screen.locationName || "Unknown Location"}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] max-w-full truncate">
                      {screen.deviceId}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <ActionIconButton
                      icon={FaPlay}
                      title="Play Ads"
                      variant="blue"
                      disabled={controllingDevice === screen.deviceId}
                      onClick={() => handleSingleControl(screen, "play")}
                    />
                    <ActionIconButton
                      icon={FaPause}
                      title="Pause Ads"
                      variant="amber"
                      disabled={controllingDevice === screen.deviceId}
                      onClick={() => handleSingleControl(screen, "pause")}
                    />
                    <ActionIconButton
                      icon={FaStop}
                      title="Stop Ads"
                      variant="red"
                      disabled={controllingDevice === screen.deviceId}
                      onClick={() => handleSingleControl(screen, "stop")}
                    />
                  </div>
                </div>
              </div>
            );
            })}
          </div>

          <Pagination
            page={safePage}
            totalItems={screens.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
            itemLabel="screens"
          />
        </>
      )}
    </div>
  );
}
