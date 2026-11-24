import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaClock,
  FaDownload,
  FaFilm,
  FaPlay,
  FaSyncAlt,
  FaTv,
  FaUndo,
} from "react-icons/fa";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import Pagination from "../../components/Pagination";
import { useToast } from "../../context/ToastContext";

const formatDuration = (totalSeconds) => {
  const sec = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export default function Analytics() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    deviceId: "",
  });
  const [logsPage, setLogsPage] = useState(1);
  const logsPerPage = 10;

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.deviceId) params.deviceId = filters.deviceId;

      const res = await api.get("/analytics/summary", { params });
      setSummary(res.data.data);
      setLogsPage(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  const recentLogs = useMemo(() => summary?.recentLogs || [], [summary]);
  const totalLogsPages = Math.max(1, Math.ceil(recentLogs.length / logsPerPage));
  const safeLogsPage = Math.min(logsPage, totalLogsPages);
  const paginatedLogs = useMemo(() => {
    return recentLogs.slice(
      (safeLogsPage - 1) * logsPerPage,
      safeLogsPage * logsPerPage
    );
  }, [recentLogs, safeLogsPage]);

  useEffect(() => {
    api
      .get("/devices/list")
      .then((res) => setDevices(res.data.data || []))
      .catch(() => { });
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.deviceId) params.deviceId = filters.deviceId;

      const res = await api.get("/analytics/export", {
        params,
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "proof-of-play.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  const maxAdPlays = Math.max(
    1,
    ...(summary?.topAds || []).map((a) => a.plays || 0)
  );
  const maxDevicePlays = Math.max(
    1,
    ...(summary?.byDevice || []).map((d) => d.plays || 0)
  );

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Proof-of-Play Logs &amp; Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track ad impressions and total playback airtime per TV screen
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ActionIconButton
            icon={FaSyncAlt}
            title="Refresh Analytics"
            variant="slate"
            size="md"
            onClick={fetchSummary}
          />
          <ActionIconButton
            icon={FaDownload}
            title="Export CSV Report"
            variant="green"
            size="md"
            disabled={exporting}
            onClick={handleExportCsv}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters({ ...filters, startDate: e.target.value })
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters({ ...filters, endDate: e.target.value })
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Device
          </label>
          <select
            value={filters.deviceId}
            onChange={(e) =>
              setFilters({ ...filters, deviceId: e.target.value })
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All Devices</option>
            {devices.map((d) => (
              <option key={d._id} value={d.deviceId}>
                {d.deviceName} ({d.deviceId})
              </option>
            ))}
          </select>
        </div>
        <ActionIconButton
          icon={FaUndo}
          title="Reset Filters"
          variant="slate"
          size="md"
          onClick={() =>
            setFilters({ startDate: "", endDate: "", deviceId: "" })
          }
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : !summary ? null : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              title="Total Plays"
              value={summary.totalPlays}
              icon={FaPlay}
              color="bg-blue-50 text-blue-600 border-blue-200"
            />
            <Card
              title="Total Airtime"
              value={formatDuration(summary.totalDurationSeconds)}
              icon={FaClock}
              color="bg-emerald-50 text-emerald-600 border-emerald-200"
            />
            <Card
              title="Active Devices"
              value={summary.uniqueDevices}
              icon={FaTv}
              color="bg-purple-50 text-purple-600 border-purple-200"
            />
            <Card
              title="Unique Ads Played"
              value={summary.uniqueAds}
              icon={FaFilm}
              color="bg-indigo-50 text-indigo-600 border-indigo-200"
            />
          </div>

          {/* Top Ads & Per Device */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-900 mb-4">
                Top Played Ads
              </h2>
              {summary.topAds?.length === 0 ? (
                <p className="text-sm text-slate-500">No play logs yet.</p>
              ) : (
                <div className="space-y-3">
                  {summary.topAds.map((a, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800 truncate">
                          {a.adTitle}{" "}
                          <span className="ml-1 text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {a.mediaType}
                          </span>
                        </span>
                        <span className="text-xs text-slate-600 shrink-0 ml-2">
                          {a.plays} plays ·{" "}
                          {formatDuration(a.totalDurationSeconds)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-blue-600 rounded-full"
                          style={{
                            width: `${Math.round((a.plays / maxAdPlays) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-900 mb-4">
                Playback by Device
              </h2>
              {summary.byDevice?.length === 0 ? (
                <p className="text-sm text-slate-500">No device logs yet.</p>
              ) : (
                <div className="space-y-3">
                  {summary.byDevice.map((d) => (
                    <div key={d.deviceId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800 truncate">
                          {d.deviceName} ({d.deviceId})
                        </span>
                        <span className="text-xs text-slate-600 shrink-0 ml-2">
                          {d.plays} plays ·{" "}
                          {formatDuration(d.totalDurationSeconds)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-emerald-600 rounded-full"
                          style={{
                            width: `${Math.round(
                              (d.plays / maxDevicePlays) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Logs Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Recent Proof-of-Play Logs
              </h2>
            </div>
            {recentLogs.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No recent logs.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                        <th className="p-3 text-left">Date / Time</th>
                        <th className="p-3 text-left">Ad Title</th>
                        <th className="p-3 text-left">Device</th>
                        <th className="p-3 text-left">Company</th>
                        <th className="p-3 text-left">Location</th>
                        <th className="p-3 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => (
                        <tr
                          key={log._id}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                        >
                          <td className="p-3 text-xs text-slate-500">
                            {log.startedAt
                              ? new Date(log.startedAt).toLocaleString()
                              : "—"}
                          </td>
                          <td className="p-3 font-medium text-slate-900">
                            {log.adTitle}
                          </td>
                          <td className="p-3 text-slate-700">
                            {log.deviceName || log.deviceId}
                          </td>
                          <td className="p-3 text-slate-600">
                            {log.company_id?.name || "—"}
                          </td>
                          <td className="p-3 text-slate-600">
                            {log.location_id?.name || "—"}
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-800">
                            {formatDuration(log.durationSeconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  page={safeLogsPage}
                  totalItems={recentLogs.length}
                  itemsPerPage={logsPerPage}
                  onPageChange={setLogsPage}
                  itemLabel="logs"
                  className="px-5 py-3 border-t border-slate-100 bg-slate-50/40"
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const Card = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-center justify-between">
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
    <span
      className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg ${color}`}
    >
      <Icon />
    </span>
  </div>
);
