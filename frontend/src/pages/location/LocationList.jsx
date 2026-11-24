import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaEdit,
  FaEye,
  FaMapMarkerAlt,
  FaPause,
  FaPlay,
  FaPlus,
  FaSearch,
  FaStop,
  FaSyncAlt,
  FaTrash,
} from "react-icons/fa";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import Pagination from "../../components/Pagination";
import { useToast } from "../../context/ToastContext";
import { getCompanies } from "../services/company.api";
import {
  deleteLocation,
  getLocationsByCompany,
} from "../services/location.api";

export default function LocationList() {
  const toast = useToast();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [busyLocationId, setBusyLocationId] = useState(null);

  useEffect(() => {
    getCompanies()
      .then((res) => {
        const list = res.data.data || [];
        setCompanies(list);
        if (list.length > 0) {
          setCompanyId((prev) => prev || list[0]._id);
        }
      })
      .catch((err) => {
        console.error("Companies fetch error:", err);
        toast.error("Failed to load companies");
      });
  }, [toast]);

  const fetchLocations = useCallback(() => {
    if (!companyId) {
      setLocations([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    getLocationsByCompany(companyId)
      .then((res) => setLocations(res.data.data || []))
      .catch((err) => {
        console.error("Locations fetch error:", err);
        setError(err?.response?.data?.message || "Failed to load locations.");
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this location?")) return;
    try {
      await deleteLocation(id);
      setLocations((prev) => prev.filter((loc) => loc._id !== id));
      toast.success("Location deleted successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete location");
    }
  };

  const handleLocationPlayback = async (locId, action) => {
    setBusyLocationId(locId);
    try {
      if (action === "play") {
        await api.post("/advertisement/play-location", {
          companyId,
          locationId: locId,
        });
        toast.success("Playing ads across location devices");
      } else if (action === "pause") {
        await api.post("/advertisement/pause-bulk", {
          companyId,
          locationId: locId,
        });
        toast.success("Paused location devices");
      } else if (action === "stop") {
        await api.post("/advertisement/stop-bulk", {
          companyId,
          locationId: locId,
        });
        toast.success("Stopped location devices");
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || `Failed to ${action} location ads`
      );
    } finally {
      setBusyLocationId(null);
    }
  };

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.address?.city?.toLowerCase().includes(q) ||
        l.contactPerson?.toLowerCase().includes(q)
    );
  }, [locations, search]);

  useEffect(() => {
    setPage(1);
  }, [companyId, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLocations.length / itemsPerPage)
  );
  const safePage = Math.min(page, totalPages);
  const paginatedLocations = useMemo(() => {
    return filteredLocations.slice(
      (safePage - 1) * itemsPerPage,
      safePage * itemsPerPage
    );
  }, [filteredLocations, safePage]);

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
            <FaMapMarkerAlt />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Locations ({filteredLocations.length})
            </h1>
            <p className="text-xs text-slate-500">
              Manage branch venues and control playback per location
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Select Company</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:flex-none">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, city, contact..."
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full sm:w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <ActionIconButton
            icon={FaSyncAlt}
            title="Refresh Locations"
            variant="slate"
            size="md"
            onClick={fetchLocations}
          />
          <ActionIconButton
            icon={FaPlus}
            title="Add Location"
            variant="blue"
            size="md"
            to="/locations/new"
          />
        </div>
      </div>

      {!companyId ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500 text-sm">
          Select a company to view locations.
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <ActionIconButton
            icon={FaSyncAlt}
            title="Retry"
            variant="red"
            onClick={fetchLocations}
          />
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500 text-sm">
          No locations found for this company.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
            <table className="w-full border-collapse min-w-[850px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="p-3.5 text-left">Location</th>
                  <th className="p-3.5 text-left">City / State</th>
                  <th className="p-3.5 text-left">Contact Person</th>
                  <th className="p-3.5 text-left">Phone / Email</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLocations.map((l) => (
                <tr
                  key={l._id}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                >
                  <td className="p-3.5 font-semibold text-slate-900">
                    {l.name}
                  </td>
                  <td className="p-3.5 text-slate-600">
                    {[l.address?.city, l.address?.state]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="p-3.5 text-slate-700">
                    {l.contactPerson || "—"}
                  </td>
                  <td className="p-3.5 text-xs text-slate-600">
                    <p>{l.phone || "—"}</p>
                    <p className="text-slate-400">{l.email || ""}</p>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <ActionIconButton
                        icon={FaPlay}
                        title="Play Ads on Location TVs"
                        variant="indigo"
                        disabled={busyLocationId === l._id}
                        onClick={() => handleLocationPlayback(l._id, "play")}
                      />
                      <ActionIconButton
                        icon={FaPause}
                        title="Pause Location TVs"
                        variant="amber"
                        disabled={busyLocationId === l._id}
                        onClick={() => handleLocationPlayback(l._id, "pause")}
                      />
                      <ActionIconButton
                        icon={FaStop}
                        title="Stop Location TVs"
                        variant="red"
                        disabled={busyLocationId === l._id}
                        onClick={() => handleLocationPlayback(l._id, "stop")}
                      />
                      <span className="w-px h-5 bg-slate-200 mx-0.5" />
                      <ActionIconButton
                        icon={FaEye}
                        title="View Location"
                        variant="blue"
                        to={`/locations/${l._id}`}
                      />
                      <ActionIconButton
                        icon={FaEdit}
                        title="Edit Location"
                        variant="green"
                        to={`/locations/${l._id}/edit`}
                      />
                      <ActionIconButton
                        icon={FaTrash}
                        title="Delete Location"
                        variant="red"
                        onClick={() => handleDelete(l._id)}
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
            totalItems={filteredLocations.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
            itemLabel="locations"
          />
        </>
      )}
    </div>
  );
}
