import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  FaBroadcastTower,
  FaBuilding,
  FaChartBar,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaFilm,
  FaListOl,
  FaMapMarkerAlt,
  FaPause,
  FaPlay,
  FaStop,
  FaSyncAlt,
  FaTv,
  FaUsers,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import { SOCKET_BASE_URL } from "../../config";
import { AuthContext } from "../../contextAuth/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getMediaUrl } from "../../utils/mediaUrl";
import { getAdminDashboardStats } from "../services/admin.api";

const isImagePath = (path) =>
  /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(path || "");

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveScreens, setLiveScreens] = useState([]);
  const [controllingDevice, setControllingDevice] = useState(null);
  const lastUpdateRef = useRef({});
  const videoRefs = useRef({});

  const groupedScreens = liveScreens.reduce((acc, screen) => {
    const company = screen.companyName || "Unknown Company";
    if (!acc[company]) acc[company] = [];
    acc[company].push(screen);
    return acc;
  }, {});

  const fetchStats = useCallback(() => {
    setLoading(true);
    setError("");
    getAdminDashboardStats()
      .then((res) => setStats(res.data.data))
      .catch((err) => {
        console.error("Stats error:", err);
        setError(
          err?.response?.data?.message || "Failed to load dashboard stats."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    liveScreens.forEach((screen) => {
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
      if (video.src !== targetSrc) {
        video.src = targetSrc;
      }

      if (
        typeof screen.currentTime === "number" &&
        Math.abs(video.currentTime - screen.currentTime) > 1.5
      ) {
        video.currentTime = screen.currentTime;
      }

      if (video.paused) {
        video.play().catch(() => {});
      }
    });
  }, [liveScreens]);

  useEffect(() => {
    const fetchLiveScreens = async () => {
      try {
        const res = await api.get("/admin/live-screens");
        setLiveScreens(res.data.data || []);
      } catch (err) {
        console.error("Live screens error:", err);
      }
    };

    fetchLiveScreens();

    const socket = io(SOCKET_BASE_URL, {
      transports: ["websocket"],
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
      setLiveScreens(
        (data || []).map((screen) => {
          const prevScreen = lastUpdateRef.current[screen.deviceId];

          if (
            prevScreen &&
            prevScreen.currentVideo === screen.currentVideo &&
            Math.abs(
              (prevScreen.currentTime || 0) - (screen.currentTime || 0)
            ) < 1
          ) {
            return prevScreen;
          }

          lastUpdateRef.current[screen.deviceId] = screen;
          return screen;
        })
      );
    });

    return () => socket.disconnect();
  }, []);

  const handleScreenControl = async (screen, action) => {
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
      <div className="w-full px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {error || "Unable to load dashboard stats."}
          </span>
          <ActionIconButton
            icon={FaSyncAlt}
            title="Retry"
            variant="red"
            onClick={fetchStats}
          />
        </div>
      </div>
    );
  }

  const offlineAlerts = stats.offlineAlerts || [];

  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {user?.role === "company_admin"
              ? "Company Admin Dashboard"
              : "Admin Dashboard"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time overview of connected screens, ads, and fleet health
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {liveScreens.length} Live
          </span>
          <ActionIconButton
            icon={FaSyncAlt}
            title="Refresh Dashboard"
            variant="slate"
            size="md"
            onClick={fetchStats}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Companies"
          value={stats.companies || 0}
          icon={FaBuilding}
          color="bg-blue-50 text-blue-600 border-blue-200"
        />
        <StatCard
          title="Locations"
          value={stats.locations || 0}
          icon={FaMapMarkerAlt}
          color="bg-indigo-50 text-indigo-600 border-indigo-200"
        />
        <StatCard
          title="Advertisements"
          value={stats.advertisements || 0}
          icon={FaFilm}
          color="bg-purple-50 text-purple-600 border-purple-200"
        />
        <StatCard
          title="Active Screens"
          value={liveScreens.length}
          icon={FaTv}
          color="bg-emerald-50 text-emerald-600 border-emerald-200"
          highlight
        />
      </div>

      {/* Offline Device Health Alerts */}
      {offlineAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-900 font-semibold">
              <FaExclamationTriangle className="text-amber-600" />
              <h2>Offline Device Alerts ({offlineAlerts.length})</h2>
            </div>
            <ActionIconButton
              icon={FaExternalLinkAlt}
              title="Open Devices"
              variant="amber"
              to="/devices"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {offlineAlerts.map((alert) => (
              <div
                key={alert.deviceId}
                className="bg-white border border-amber-200 rounded-lg p-3 text-sm shadow-xs"
              >
                <p className="font-semibold text-slate-900">
                  {alert.deviceName}
                </p>
                <p className="text-xs text-slate-500">
                  {alert.deviceId} · {alert.companyName}
                </p>
                <p className="text-xs text-red-600 font-semibold mt-1">
                  Offline ~{alert.offlineMinutes} min
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Video Wall */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Live Video Wall ({liveScreens.length})
            </h2>
            <p className="text-xs text-slate-500">
              Instant remote preview and playback controls per TV screen
            </p>
          </div>
          <ActionIconButton
            icon={FaBroadcastTower}
            title="Open Full Live Screens Console"
            variant="blue"
            size="md"
            to="/live-screens"
          />
        </div>

        {liveScreens.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
            No live screens currently connected. Open{" "}
            <span className="font-mono text-slate-700">/pair</span> or a device{" "}
            <span className="font-mono text-slate-700">/screen/:token</span> URL
            to stream live.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedScreens).map(([company, screens]) => (
              <div key={company}>
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2">
                    <FaBuilding className="text-sm" /> {company}
                  </h3>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {screens.length} Screen{screens.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {screens.map((screen) => {
                    const statusBadge =
                      screen.currentVideo === "PAUSED"
                        ? {
                            label: "Paused",
                            cls: "bg-amber-100 text-amber-800",
                          }
                        : screen.currentVideo
                          ? {
                              label: "Playing",
                              cls: "bg-emerald-100 text-emerald-700",
                            }
                          : {
                              label: "Idle",
                              cls: "bg-slate-100 text-slate-600",
                            };

                    return (
                      <div
                        key={screen.deviceId}
                        className="border border-slate-200 rounded-xl shadow-xs bg-white overflow-hidden"
                      >
                        <div className="relative bg-black h-52">
                          {screen.currentVideo === "PAUSED" ? (
                            <div className="w-full h-full bg-amber-500 flex items-center justify-center text-white font-bold">
                              ⏸ Paused
                            </div>
                          ) : screen.currentVideo &&
                            isImagePath(screen.currentVideo) ? (
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
                              muted
                              autoPlay
                              playsInline
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-300 text-sm">
                              Waiting for advertisement…
                            </div>
                          )}

                          <span
                            className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge.cls}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>

                        <div className="p-3.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">
                              {screen.locationName || "Unknown Location"}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              Device: {screen.deviceId}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <ActionIconButton
                              icon={FaPlay}
                              title="Play Ads"
                              variant="blue"
                              disabled={controllingDevice === screen.deviceId}
                              onClick={() =>
                                handleScreenControl(screen, "play")
                              }
                            />
                            <ActionIconButton
                              icon={FaPause}
                              title="Pause Ads"
                              variant="amber"
                              disabled={controllingDevice === screen.deviceId}
                              onClick={() =>
                                handleScreenControl(screen, "pause")
                              }
                            />
                            <ActionIconButton
                              icon={FaStop}
                              title="Stop Ads"
                              variant="red"
                              disabled={controllingDevice === screen.deviceId}
                              onClick={() =>
                                handleScreenControl(screen, "stop")
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLink
          title="Manage Companies"
          desc="View & edit company profiles"
          to="/companies"
          icon={FaBuilding}
        />
        <QuickLink
          title="Manage Locations"
          desc="Branches & display zones"
          to="/locations"
          icon={FaMapMarkerAlt}
        />
        <QuickLink
          title="Manage Devices"
          desc="Pair TVs, copy URLs & settings"
          to="/devices"
          icon={FaTv}
        />
        <QuickLink
          title="Manage Advertisements"
          desc="Upload videos, images & schedules"
          to="/advertisements"
          icon={FaFilm}
        />
        <QuickLink
          title="Playlist Builder"
          desc="Drag-and-drop ad order"
          to="/playlist-builder"
          icon={FaListOl}
        />
        <QuickLink
          title="Live Screens"
          desc="Bulk fleet control & emergency alert"
          to="/live-screens"
          icon={FaBroadcastTower}
        />
        <QuickLink
          title="Proof-of-Play Analytics"
          desc="Playback counts, airtime & CSV"
          to="/analytics"
          icon={FaChartBar}
        />
        {user?.role === "admin" && (
          <QuickLink
            title="User Management"
            desc="Assign Admin & Company Admin roles"
            to="/users"
            icon={FaUsers}
          />
        )}
      </div>
    </div>
  );
}

const StatCard = ({ title, value, icon: Icon, color, highlight }) => (
  <div
    className={`p-5 rounded-xl shadow-sm bg-white border flex items-center justify-between ${
      highlight ? "border-emerald-400" : "border-slate-200"
    }`}
  >
    <div>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">
        {title}
      </p>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
    <span
      className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl ${color}`}
    >
      <Icon />
    </span>
  </div>
);

const QuickLink = ({ title, desc, to, icon: Icon }) => (
  <Link
    to={to}
    className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition flex items-start gap-3.5"
  >
    <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
      <Icon />
    </span>
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
  </Link>
);
