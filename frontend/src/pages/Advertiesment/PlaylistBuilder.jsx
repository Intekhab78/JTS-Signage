import React, { useEffect, useMemo, useState } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaFilm,
  FaGripVertical,
  FaImage,
  FaListOl,
  FaSave,
} from "react-icons/fa";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import { useToast } from "../../context/ToastContext";
import { getAdvertisement } from "../services/advertisement.api";
import { getCompanies } from "../services/company.api";
import { getLocationsByCompany } from "../services/location.api";

export default function PlaylistBuilder() {
  const toast = useToast();
  const [ads, setAds] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);

  const [companyId, setCompanyId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [deviceId, setDeviceId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    Promise.all([
      getAdvertisement(),
      getCompanies(),
      api.get("/devices/list"),
    ])
      .then(([adsRes, compRes, devRes]) => {
        const sorted = [...(adsRes.data.data || [])].sort(
          (a, b) => (a.playOrder || 1) - (b.playOrder || 1)
        );
        setAds(sorted);
        setCompanies(compRes.data.data || []);
        setDevices(devRes.data.data || []);
      })
      .catch(() => toast.error("Failed to load playlist data"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    if (!companyId) {
      setLocations([]);
      setLocationId("");
      return;
    }
    getLocationsByCompany(companyId)
      .then((res) => setLocations(res.data.data || []))
      .catch(() => {});
  }, [companyId]);

  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      if (
        companyId &&
        !(ad.company_ids || []).some(
          (c) => String(c._id || c) === String(companyId)
        )
      ) {
        return false;
      }
      if (
        locationId &&
        !(ad.location_ids || []).some(
          (l) => String(l._id || l) === String(locationId)
        )
      ) {
        return false;
      }
      if (
        deviceId &&
        ad.deviceId?.length > 0 &&
        !ad.deviceId.includes(deviceId)
      ) {
        return false;
      }
      return true;
    });
  }, [ads, companyId, locationId, deviceId]);

  const moveAd = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= filteredAds.length || fromIdx === toIdx) return;

    const reorderedSubset = [...filteredAds];
    const [moved] = reorderedSubset.splice(fromIdx, 1);
    reorderedSubset.splice(toIdx, 0, moved);

    const subsetIds = new Set(reorderedSubset.map((a) => a._id));
    let ptr = 0;
    const nextAds = ads.map((ad) =>
      subsetIds.has(ad._id) ? reorderedSubset[ptr++] : ad
    );

    setAds(
      nextAds.map((ad, idx) => ({
        ...ad,
        playOrder: idx + 1,
      }))
    );
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const items = ads.map((ad, idx) => ({
        id: ad._id,
        playOrder: idx + 1,
      }));
      await api.put("/advertisement/reorder", { items });
      toast.success("Playlist order saved");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-slate-200 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
            <FaListOl />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Playlist Builder ({filteredAds.length})
            </h1>
            <p className="text-xs text-slate-500">
              Drag rows or use arrow buttons to reorder playback sequence
            </p>
          </div>
        </div>

        <ActionIconButton
          icon={FaSave}
          title="Save Playlist Order"
          variant="blue"
          size="md"
          disabled={saving || ads.length === 0}
          onClick={handleSaveOrder}
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="border border-slate-300 rounded-lg p-2 text-sm bg-white"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={!companyId}
          className="border border-slate-300 rounded-lg p-2 text-sm bg-white disabled:bg-slate-100"
        >
          <option value="">All Locations</option>
          {locations.map((l) => (
            <option key={l._id} value={l._id}>
              {l.name}
            </option>
          ))}
        </select>

        <select
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          className="border border-slate-300 rounded-lg p-2 text-sm bg-white"
        >
          <option value="">All Devices</option>
          {devices.map((d) => (
            <option key={d._id} value={d.deviceId}>
              {d.deviceName} ({d.deviceId})
            </option>
          ))}
        </select>
      </div>

      {filteredAds.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500 text-sm">
          No advertisements match the selected filters.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAds.map((ad, index) => {
            const isImage = ad.mediaType === "image";
            return (
              <div
                key={ad._id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) {
                    moveAd(dragIndex, index);
                    setDragIndex(null);
                  }
                }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm cursor-move hover:border-blue-400 transition"
              >
                <div className="flex items-center gap-3">
                  <FaGripVertical className="text-slate-400 shrink-0" />
                  <span className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                    {index + 1}
                  </span>
                  <span
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                      isImage
                        ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                        : "bg-blue-50 text-blue-600 border-blue-200"
                    }`}
                  >
                    {isImage ? <FaImage /> : <FaFilm />}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {ad.title}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] rounded bg-purple-50 text-purple-700 font-medium">
                        Priority: {ad.priority || 1}
                      </span>
                      {ad.isFallback && (
                        <span className="px-2 py-0.5 text-[11px] rounded bg-amber-100 text-amber-800 font-semibold">
                          Fallback
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Companies:{" "}
                      {(ad.company_ids || []).map((c) => c.name).join(", ") ||
                        "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <ActionIconButton
                    icon={FaArrowUp}
                    title="Move Up"
                    variant="slate"
                    disabled={index === 0}
                    onClick={() => moveAd(index, index - 1)}
                  />
                  <ActionIconButton
                    icon={FaArrowDown}
                    title="Move Down"
                    variant="slate"
                    disabled={index === filteredAds.length - 1}
                    onClick={() => moveAd(index, index + 1)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
