import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  FaBroom,
  FaCheckCircle,
  FaCog,
  FaCopy,
  FaEdit,
  FaExternalLinkAlt,
  FaPlus,
  FaQrcode,
  FaSave,
  FaSearch,
  FaSyncAlt,
  FaTimesCircle,
  FaTrash,
  FaTv,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import Pagination from "../../components/Pagination";
import { AuthContext } from "../../contextAuth/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getCompanies } from "../services/company.api";
import { getLocationsByCompany } from "../services/location.api";

const DeviceList = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useContext(AuthContext);

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [connectionFilter, setConnectionFilter] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

  // Pair TV Modal
  const [showPairModal, setShowPairModal] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [pairLocations, setPairLocations] = useState([]);
  const [pairingSubmitting, setPairingSubmitting] = useState(false);
  const [pairForm, setPairForm] = useState({
    code: "",
    deviceId: "",
    deviceName: "",
    company_id: user?.role === "company_admin" ? user.company_id || "" : "",
    location_id: "",
  });

  // Screen Settings Modal
  const [settingsDevice, setSettingsDevice] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    volume: 100,
    muted: false,
    orientation: "0",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/devices/list");
      setDevices(res.data.data || []);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to load devices";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (!showPairModal) return;
    getCompanies()
      .then((res) => setCompanies(res.data.data || []))
      .catch(() => {});
  }, [showPairModal]);

  useEffect(() => {
    if (!pairForm.company_id) {
      setPairLocations([]);
      return;
    }
    getLocationsByCompany(pairForm.company_id)
      .then((res) => setPairLocations(res.data.data || []))
      .catch(() => {});
  }, [pairForm.company_id]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this device?")) return;

    try {
      await api.delete(`/devices/delete/${id}`);
      toast.success("Device deleted successfully");
      fetchDevices();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const handleCopyUrl = async (token) => {
    const fullUrl = `${window.location.origin}/screen/${token}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Screen URL copied");
    } catch {
      toast.error("Failed to copy Screen URL");
    }
  };

  const handlePairSubmit = async (e) => {
    e.preventDefault();
    if (pairingSubmitting) return;
    setPairingSubmitting(true);

    try {
      await api.post("/devices/pair/complete", {
        ...pairForm,
        location_id: pairForm.location_id ? [pairForm.location_id] : [],
      });
      toast.success("TV paired successfully!");
      setShowPairModal(false);
      setPairForm({
        code: "",
        deviceId: "",
        deviceName: "",
        company_id:
          user?.role === "company_admin" ? user.company_id || "" : "",
        location_id: "",
      });
      fetchDevices();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to pair TV");
    } finally {
      setPairingSubmitting(false);
    }
  };

  const openSettingsModal = (device) => {
    setSettingsDevice(device);
    setSettingsForm({
      volume: device.settings?.volume ?? 100,
      muted: Boolean(device.settings?.muted),
      orientation: device.settings?.orientation ?? "0",
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settingsDevice || savingSettings) return;
    setSavingSettings(true);

    try {
      await api.put(`/devices/settings/${settingsDevice._id}`, settingsForm);
      toast.success("Screen settings updated");
      setSettingsDevice(null);
      fetchDevices();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRemoteCommand = async (command) => {
    if (!settingsDevice) return;
    try {
      const res = await api.post(`/devices/command/${settingsDevice._id}`, {
        command,
      });
      toast.success(res.data.message || `Command '${command}' sent`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send command");
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
      total: devices.length,
      online: devices.filter((d) => d.isOnline).length,
      offline: devices.filter((d) => !d.isOnline).length,
      active: devices.filter((d) => d.status === "active").length,
    }),
    [devices]
  );

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => {
      const matchesSearch =
        !q ||
        d.deviceName?.toLowerCase().includes(q) ||
        d.deviceId?.toLowerCase().includes(q) ||
        d.company_id?.name?.toLowerCase().includes(q);
      const matchesConnection =
        !connectionFilter ||
        (connectionFilter === "online" ? d.isOnline : !d.isOnline);
      return matchesSearch && matchesConnection;
    });
  }, [devices, search, connectionFilter]);

  const sortedDevices = useMemo(() => {
    if (!sortField) return filteredDevices;

    return [...filteredDevices].sort((a, b) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";

      return sortDirection === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredDevices, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedDevices.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginatedDevices = useMemo(() => {
    return sortedDevices.slice(
      (safePage - 1) * itemsPerPage,
      safePage * itemsPerPage
    );
  }, [sortedDevices, safePage]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-6 space-y-4">
        <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <FaTv />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Devices ({devices.length})
            </h1>
            <p className="text-xs text-slate-500">
              Pair TVs, configure display orientation/audio, and track uptime
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
              placeholder="Search name, ID, company..."
              className="border border-slate-300 pl-9 pr-3 py-2 rounded-lg text-sm bg-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={connectionFilter}
            onChange={(e) => {
              setConnectionFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All Connections</option>
            <option value="online">Online Only</option>
            <option value="offline">Offline Only</option>
          </select>

          <ActionIconButton
            icon={FaSyncAlt}
            title="Refresh Devices"
            variant="slate"
            size="md"
            onClick={fetchDevices}
          />
          <ActionIconButton
            icon={FaQrcode}
            title="Pair TV by 6-Digit Code"
            variant="purple"
            size="md"
            onClick={() => setShowPairModal(true)}
          />
          <ActionIconButton
            icon={FaPlus}
            title="Add Device"
            variant="blue"
            size="md"
            to="/add-device"
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Total Devices" value={stats.total} />
        <MiniStat label="Online Now" value={stats.online} accent="emerald" />
        <MiniStat label="Offline" value={stats.offline} accent="slate" />
        <MiniStat label="Active Status" value={stats.active} accent="blue" />
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <ActionIconButton
            icon={FaSyncAlt}
            title="Retry"
            variant="red"
            onClick={fetchDevices}
          />
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500 text-sm">
          No devices found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3.5 text-left">#</th>
                  <th
                    onClick={() => handleSort("deviceId")}
                    className="cursor-pointer p-3.5 text-left"
                  >
                    Device ID{" "}
                    {sortField === "deviceId" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("deviceName")}
                    className="cursor-pointer p-3.5 text-left"
                  >
                    Device Name{" "}
                    {sortField === "deviceName" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-3.5 text-left">Company &amp; Locations</th>
                  <th className="p-3.5 text-left">Screen URL</th>
                  <th className="p-3.5 text-left">Connection</th>
                  <th className="p-3.5 text-left">Display / Audio</th>
                  <th className="p-3.5 text-left">Status</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedDevices.map((d, i) => (
                  <tr
                    key={d._id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="p-3.5 text-slate-500">
                      {(safePage - 1) * itemsPerPage + i + 1}
                    </td>

                    <td className="p-3.5 font-mono text-xs font-semibold text-slate-800">
                      {d.deviceId}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900">
                      {d.deviceName || "—"}
                    </td>
                    <td className="p-3.5 text-xs text-slate-600">
                      <p className="font-medium text-slate-800">
                        {d.company_id?.name || "—"}
                      </p>
                      <p className="text-slate-400">
                        {Array.isArray(d.location_id) &&
                        d.location_id.length > 0
                          ? d.location_id.map((loc) => loc.name).join(", ")
                          : "—"}
                      </p>
                    </td>

                    <td className="p-3.5">
                      {d.screenToken ? (
                        <div className="flex items-center gap-1.5">
                          <ActionIconButton
                            icon={FaCopy}
                            title="Copy Screen URL"
                            variant="purple"
                            onClick={() => handleCopyUrl(d.screenToken)}
                          />
                          <ActionIconButton
                            icon={FaExternalLinkAlt}
                            title={`Open /screen/${d.screenToken}`}
                            variant="blue"
                            href={`${window.location.origin}/screen/${d.screenToken}`}
                            target="_blank"
                          />
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="p-3.5 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full font-semibold ${
                            d.isOnline
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              d.isOnline ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {d.isOnline ? "Online" : "Offline"}
                        </span>
                        <span className="text-slate-400">
                          {d.lastSeen
                            ? new Date(d.lastSeen).toLocaleString()
                            : "Never"}
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {d.settings?.muted ? (
                            <FaVolumeMute className="text-red-500" />
                          ) : (
                            <FaVolumeUp className="text-blue-600" />
                          )}
                          {d.settings?.volume ?? 100}%
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {d.settings?.orientation ?? "0"}°
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          d.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="flex justify-center gap-1.5">
                        <ActionIconButton
                          icon={FaCog}
                          title="Screen Settings & Remote Commands"
                          variant="indigo"
                          onClick={() => openSettingsModal(d)}
                        />
                        <ActionIconButton
                          icon={FaEdit}
                          title="Edit Device"
                          variant="amber"
                          onClick={() => navigate(`/edit-device/${d._id}`)}
                        />
                        <ActionIconButton
                          icon={FaTrash}
                          title="Delete Device"
                          variant="red"
                          onClick={() => handleDelete(d._id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalItems={sortedDevices.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
            itemLabel="devices"
          />
        </>
      )}

      {/* Pair TV Modal */}
      {showPairModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Pair TV by 6-Digit Code
                </h3>
                <p className="text-xs text-slate-500">
                  Link a screen showing /pair directly to a company location
                </p>
              </div>
              <ActionIconButton
                icon={FaTimesCircle}
                title="Close"
                variant="slate"
                size="sm"
                onClick={() => setShowPairModal(false)}
              />
            </div>

            <form onSubmit={handlePairSubmit}>
              <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    6-Digit Pairing Code (Shown on TV /pair) *
                  </label>
                  <input
                    required
                    value={pairForm.code}
                    onChange={(e) =>
                      setPairForm({ ...pairForm, code: e.target.value })
                    }
                    placeholder="e.g. 482910"
                    className="w-full h-[38px] border border-slate-300 rounded-lg px-3 font-mono tracking-widest text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                      Device ID *
                    </label>
                    <input
                      required
                      value={pairForm.deviceId}
                      onChange={(e) =>
                        setPairForm({ ...pairForm, deviceId: e.target.value })
                      }
                      placeholder="e.g. TV-LOBBY-01"
                      className="w-full h-[38px] border border-slate-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                      Device Name *
                    </label>
                    <input
                      required
                      value={pairForm.deviceName}
                      onChange={(e) =>
                        setPairForm({ ...pairForm, deviceName: e.target.value })
                      }
                      placeholder="e.g. Main Lobby Display"
                      className="w-full h-[38px] border border-slate-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                      Company *
                    </label>
                    <select
                      required
                      value={pairForm.company_id}
                      onChange={(e) =>
                        setPairForm({
                          ...pairForm,
                          company_id: e.target.value,
                          location_id: "",
                        })
                      }
                      className="w-full h-[38px] border border-slate-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                      Location
                    </label>
                    <select
                      value={pairForm.location_id}
                      onChange={(e) =>
                        setPairForm({ ...pairForm, location_id: e.target.value })
                      }
                      className="w-full h-[38px] border border-slate-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Location</option>
                      {pairLocations.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">* Required fields</span>
                <div className="flex items-center gap-2">
                  <ActionIconButton
                    icon={FaTimesCircle}
                    title="Cancel"
                    variant="slate"
                    size="md"
                    onClick={() => setShowPairModal(false)}
                  />
                  <ActionIconButton
                    icon={FaCheckCircle}
                    title="Pair TV Now"
                    variant="purple"
                    size="md"
                    type="submit"
                    disabled={pairingSubmitting}
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screen Settings & Remote Control Modal */}
      {settingsDevice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  Screen Settings — {settingsDevice.deviceName}
                </h3>
                <p className="text-xs text-slate-500 font-mono truncate">
                  {settingsDevice.deviceId}
                </p>
              </div>
              <ActionIconButton
                icon={FaTimesCircle}
                title="Close"
                variant="slate"
                size="sm"
                onClick={() => setSettingsDevice(null)}
              />
            </div>

            <form onSubmit={handleSaveSettings}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                      Volume ({settingsForm.volume}%)
                    </label>
                    <div className="h-[38px] px-3 border border-slate-300 rounded-lg bg-white flex items-center">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settingsForm.volume}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            volume: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                      Audio Output
                    </label>
                    <label className="h-[38px] px-3 border border-slate-300 rounded-lg bg-white flex items-center gap-2 text-sm cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={settingsForm.muted}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            muted: e.target.checked,
                          })
                        }
                      />
                      <span className="truncate">Mute Audio on TV</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    Orientation
                  </label>
                  <select
                    value={settingsForm.orientation}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        orientation: e.target.value,
                      })
                    }
                    className="w-full h-[38px] border border-slate-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">0° (Landscape Standard)</option>
                    <option value="90">90° (Portrait Right)</option>
                    <option value="180">180° (Inverted)</option>
                    <option value="270">270° (Portrait Left)</option>
                  </select>
                </div>

                <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Remote Commands
                  </span>
                  <div className="flex gap-2">
                    <ActionIconButton
                      icon={FaSyncAlt}
                      title="Reload TV Browser"
                      variant="slate"
                      size="md"
                      onClick={() => handleRemoteCommand("reload")}
                    />
                    <ActionIconButton
                      icon={FaBroom}
                      title="Clear TV Offline Cache & Reload"
                      variant="amber"
                      size="md"
                      onClick={() => handleRemoteCommand("clear_cache")}
                    />
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-200 flex justify-end gap-2">
                <ActionIconButton
                  icon={FaTimesCircle}
                  title="Close"
                  variant="slate"
                  size="md"
                  onClick={() => setSettingsDevice(null)}
                />
                <ActionIconButton
                  icon={FaSave}
                  title="Save Screen Settings"
                  variant="blue"
                  size="md"
                  type="submit"
                  disabled={savingSettings}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MiniStat = ({ label, value, accent = "slate" }) => {
  const colorMap = {
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    slate: "text-slate-900",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs uppercase font-medium text-slate-500">{label}</p>
      <p
        className={`text-2xl font-bold mt-1 ${colorMap[accent] || colorMap.slate}`}
      >
        {value}
      </p>
    </div>
  );
};

export default DeviceList;
