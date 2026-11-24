import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaEdit,
  FaExternalLinkAlt,
  FaEye,
  FaFilm,
  FaImage,
  FaListOl,
  FaPause,
  FaPlay,
  FaPlus,
  FaSearch,
  FaStop,
  FaSyncAlt,
  FaTrash,
} from "react-icons/fa";
import { io } from "socket.io-client";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import Pagination from "../../components/Pagination";
import { SOCKET_BASE_URL } from "../../config";
import { useToast } from "../../context/ToastContext";
import {
  deleteAdvertisement,
  getAdvertisement,
} from "../services/advertisement.api";

const isImageAd = (ad) =>
  ad?.mediaType === "image" ||
  /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(ad?.videoPath || "");

export default function AdvertisementList() {
  const toast = useToast();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState([]);
  const [deviceMap, setDeviceMap] = useState({});
  const [pausedDevices, setPausedDevices] = useState([]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const socketRef = useRef(null);

  const syncStatusFromScreens = (screens = []) => {
    const playing = [];
    const paused = [];

    screens.forEach((s) => {
      if (s.currentVideo === "PAUSED") {
        paused.push(s.deviceId);
      } else if (s.currentVideo) {
        playing.push(s.deviceId);
      }
    });

    setIsPlaying(playing);
    setPausedDevices(paused);
  };

  const fetchAds = async () => {
    setLoading(true);
    try {
      const [adsRes, deviceRes, liveRes] = await Promise.all([
        getAdvertisement(),
        api.get("/devices/list"),
        api.get("/admin/live-screens"),
      ]);

      setAds(adsRes.data.data || []);

      const map = {};
      (deviceRes.data.data || []).forEach((d) => {
        map[d.deviceId] = d;
      });
      setDeviceMap(map);

      syncStatusFromScreens(liveRes.data.data || []);
    } catch (err) {
      console.error("Fetch failed:", err);
      toast.error("Failed to load advertisements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  useEffect(() => {
    if (!SOCKET_BASE_URL) return;

    socketRef.current = io(SOCKET_BASE_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    const joinMonitors = () => {
      const token = localStorage.getItem("token");
      if (token) {
        socketRef.current?.emit("join_admin_monitors", token);
      }
    };

    socketRef.current.on("connect", joinMonitors);
    if (socketRef.current.connected) joinMonitors();

    socketRef.current.on("live_screens_update", (screens) => {
      syncStatusFromScreens(screens || []);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Deactivate this advertisement?")) return;
    try {
      await deleteAdvertisement(id);
      toast.success("Advertisement deleted successfully");
      fetchAds();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to delete advertisement"
      );
    }
  };

  const getTargetDeviceIds = (ad) => {
    if (Array.isArray(ad.deviceId) && ad.deviceId.length > 0) {
      return ad.deviceId;
    }

    const adLocIds = (ad.location_ids || []).map((l) =>
      String(typeof l === "string" ? l : l._id)
    );

    if (!adLocIds.length) return [];

    return Object.values(deviceMap)
      .filter((d) =>
        (d.location_id || []).some((loc) =>
          adLocIds.includes(String(typeof loc === "string" ? loc : loc._id))
        )
      )
      .map((d) => d.deviceId);
  };

  const playAllInLocation = async (ad, deviceIds = []) => {
    try {
      const companyIds = (ad.company_ids || []).map((c) =>
        typeof c === "string" ? c : c._id
      );
      const locationIds = (ad.location_ids || []).map((l) =>
        typeof l === "string" ? l : l._id
      );

      for (const deviceId of deviceIds) {
        await api.post("/advertisement/play", {
          companyIds,
          locationIds,
          companyId: companyIds[0],
          locationId: locationIds[0],
          deviceId,
        });
      }

      setIsPlaying((prev) => Array.from(new Set([...prev, ...deviceIds])));
      setPausedDevices((prev) =>
        prev.filter((id) => !deviceIds.includes(id))
      );
      toast.success("Playback started on target devices");
    } catch (error) {
      console.error("Play All Error:", error);
      toast.error(error?.response?.data?.message || "Play All failed");
    }
  };

  const stopAllInLocation = async (ad, deviceIds = []) => {
    try {
      const companyId = ad.company_ids?.[0]?._id || ad.company_ids?.[0];
      await Promise.all(
        deviceIds.map((deviceId) =>
          api.post("/advertisement/stop", {
            companyId,
            deviceId,
          })
        )
      );

      setIsPlaying((prev) => prev.filter((id) => !deviceIds.includes(id)));
      setPausedDevices((prev) =>
        prev.filter((id) => !deviceIds.includes(id))
      );
      toast.success("Playback stopped on target devices");
    } catch (error) {
      console.error("Stop All Error:", error);
      toast.error(error?.response?.data?.message || "Stop All failed");
    }
  };

  const pauseAllInLocation = async (ad, deviceIds = []) => {
    try {
      const companyId = ad.company_ids?.[0]?._id || ad.company_ids?.[0];
      await Promise.all(
        deviceIds.map((deviceId) =>
          api.post("/advertisement/pause", {
            companyId,
            deviceId,
          })
        )
      );

      setPausedDevices((prev) => Array.from(new Set([...prev, ...deviceIds])));
      setIsPlaying((prev) => prev.filter((id) => !deviceIds.includes(id)));
      toast.success("Playback paused on target devices");
    } catch (error) {
      console.error("Pause All Error:", error);
      toast.error(error?.response?.data?.message || "Pause failed");
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const stats = useMemo(
    () => ({
      total: ads.length,
      videos: ads.filter((a) => !isImageAd(a)).length,
      images: ads.filter((a) => isImageAd(a)).length,
      fallback: ads.filter((a) => a.isFallback).length,
      playingDevices: isPlaying.length,
    }),
    [ads, isPlaying]
  );

  const filteredAds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ads.filter((ad) => {
      const matchesSearch =
        !q ||
        ad.title?.toLowerCase().includes(q) ||
        ad.tickerText?.toLowerCase().includes(q);
      const img = isImageAd(ad);
      const matchesType =
        !typeFilter ||
        (typeFilter === "image" && img) ||
        (typeFilter === "video" && !img) ||
        (typeFilter === "fallback" && ad.isFallback);
      return matchesSearch && matchesType;
    });
  }, [ads, search, typeFilter]);

  const sortedAds = useMemo(() => {
    if (!sortField) return filteredAds;

    return [...filteredAds].sort((a, b) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";

      return sortDirection === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredAds, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedAds.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginatedAds = useMemo(() => {
    return sortedAds.slice(
      (safePage - 1) * itemsPerPage,
      safePage * itemsPerPage
    );
  }, [sortedAds, safePage]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-6 space-y-4">
        <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-full space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
            <FaFilm />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Advertisements ({ads.length})
            </h1>
            <p className="text-xs text-slate-500">
              Manage media campaigns, schedules, and push live TV playback
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search title or ticker..."
              className="border border-slate-300 pl-9 pr-3 py-2 rounded-lg text-sm bg-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All Campaigns</option>
            <option value="video">Videos Only</option>
            <option value="image">Images Only</option>
            <option value="fallback">Fallback Only</option>
          </select>

          <ActionIconButton
            icon={FaSyncAlt}
            title="Refresh Advertisements"
            variant="slate"
            size="md"
            onClick={fetchAds}
          />
          <ActionIconButton
            icon={FaListOl}
            title="Open Playlist Builder"
            variant="indigo"
            size="md"
            to="/playlist-builder"
          />
          <ActionIconButton
            icon={FaPlus}
            title="Add Advertisement"
            variant="blue"
            size="md"
            to="/advertisements/new"
          />
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi title="Total Ads" value={stats.total} />
        <Kpi title="Videos" value={stats.videos} />
        <Kpi title="Images" value={stats.images} />
        <Kpi title="Fallback Defaults" value={stats.fallback} />
        <Kpi title="Playing Devices" value={stats.playingDevices} />
      </div>

      {filteredAds.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500 text-sm">
          No advertisements found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full min-w-[1050px] border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th
                    onClick={() => handleSort("title")}
                    className="cursor-pointer p-3.5 text-left"
                  >
                    Campaign{" "}
                    {sortField === "title" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-3.5 text-left">Company</th>
                  <th className="p-3.5 text-left">Location</th>
                  <th className="p-3.5 text-left">Screens</th>
                  <th className="p-3.5 text-left">Devices</th>
                  <th className="p-3.5 text-left">Status</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedAds.map((ad) => {
                  const targetDeviceIds = getTargetDeviceIds(ad);
                  const isLocationWide =
                    !Array.isArray(ad.deviceId) || ad.deviceId.length === 0;
                  const img = isImageAd(ad);

                  const isAnyPaused = targetDeviceIds.some((d) =>
                    pausedDevices.includes(d)
                  );
                  const isAnyPlaying = targetDeviceIds.some((d) =>
                    isPlaying.includes(d)
                  );

                  const hasSchedule = Boolean(
                    ad.startDate ||
                      ad.endDate ||
                      ad.startTime ||
                      ad.endTime ||
                      (ad.days && ad.days.length > 0)
                  );

                  return (
                    <tr
                      key={ad._id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="p-3.5">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                              img
                                ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                                : "bg-blue-50 text-blue-600 border-blue-200"
                            }`}
                          >
                            {img ? <FaImage /> : <FaFilm />}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {ad.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                Order #{ad.playOrder ?? 1}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                                Prio {ad.priority ?? 1}
                              </span>
                              {ad.isFallback && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                  Fallback
                                </span>
                              )}
                              {hasSchedule && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                                  Scheduled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-700 text-xs">
                        {Array.isArray(ad.company_ids) &&
                        ad.company_ids.length > 0
                          ? ad.company_ids.map((c) => c.name).join(", ")
                          : "—"}
                      </td>

                      <td className="p-3.5 text-slate-700 text-xs">
                        {Array.isArray(ad.location_ids) &&
                        ad.location_ids.length > 0
                          ? ad.location_ids.map((l) => l.name).join(", ")
                          : "—"}
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isLocationWide && targetDeviceIds.length > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              Location-wide
                            </span>
                          )}
                          {targetDeviceIds.map((mac) => {
                            const device = deviceMap[mac];
                            if (!device?.screenToken) return null;
                            return (
                              <ActionIconButton
                                key={mac}
                                icon={FaExternalLinkAlt}
                                title={`Open Screen: ${
                                  device.deviceName || mac
                                } (/screen/${device.screenToken})`}
                                variant="purple"
                                href={`${window.location.origin}/screen/${device.screenToken}`}
                                target="_blank"
                              />
                            );
                          })}
                        </div>
                      </td>

                      <td className="p-3.5 text-xs text-slate-600">
                        {targetDeviceIds.length > 0
                          ? targetDeviceIds
                              .map((mac) => deviceMap[mac]?.deviceName || mac)
                              .join(", ")
                          : "—"}
                      </td>

                      <td className="p-3.5">
                        {isAnyPaused ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            Paused
                          </span>
                        ) : isAnyPlaying ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            Playing
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <ActionIconButton
                            icon={FaEye}
                            title="View Advertisement"
                            variant="blue"
                            to={`/advertisements/${ad._id}`}
                          />
                          <ActionIconButton
                            icon={FaEdit}
                            title="Edit Advertisement"
                            variant="green"
                            to={`/advertisements/${ad._id}/edit`}
                          />
                          <ActionIconButton
                            icon={FaTrash}
                            title="Delete Advertisement"
                            variant="red"
                            onClick={() => handleDelete(ad._id)}
                          />

                          {targetDeviceIds.length > 0 && (
                            <>
                              <span className="w-px h-5 bg-slate-200 mx-0.5" />
                              <ActionIconButton
                                icon={FaPlay}
                                title="Play on Target Devices"
                                variant="indigo"
                                onClick={() =>
                                  playAllInLocation(ad, targetDeviceIds)
                                }
                              />
                              <ActionIconButton
                                icon={FaPause}
                                title="Pause on Target Devices"
                                variant="amber"
                                onClick={() =>
                                  pauseAllInLocation(ad, targetDeviceIds)
                                }
                              />
                              <ActionIconButton
                                icon={FaStop}
                                title="Stop on Target Devices"
                                variant="red"
                                onClick={() =>
                                  stopAllInLocation(ad, targetDeviceIds)
                                }
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalItems={sortedAds.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
            itemLabel="advertisements"
          />
        </>
      )}
    </div>
  );
}

const Kpi = ({ title, value }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
    <p className="text-[11px] uppercase font-medium text-slate-500">{title}</p>
    <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
  </div>
);
