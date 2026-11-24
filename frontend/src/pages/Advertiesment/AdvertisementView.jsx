import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaEdit, FaFilm, FaImage } from "react-icons/fa";
import { useParams } from "react-router-dom";
import ActionIconButton from "../../components/ActionIconButton";
import { getMediaUrl } from "../../utils/mediaUrl";
import { getAdvertisementById } from "../services/advertisement.api";

export default function AdvertisementView() {
  const { id } = useParams();
  const [ad, setAd] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdvertisementById(id)
      .then((res) => {
        setAd(res.data.data);
      })
      .catch((err) => {
        console.error("Fetch ad error:", err);
        setError(err?.response?.data?.message || "Failed to load advertisement");
      });
  }, [id]);

  if (error) {
    return (
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Advertisements"
            variant="slate"
            to="/advertisements"
          />
        </div>
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const companies =
    Array.isArray(ad.company_ids) && ad.company_ids.length > 0
      ? ad.company_ids.map((c) => c.name || c).join(", ")
      : "—";

  const locations =
    Array.isArray(ad.location_ids) && ad.location_ids.length > 0
      ? ad.location_ids.map((l) => l.name || l).join(", ")
      : "—";

  const devices =
    Array.isArray(ad.deviceId) && ad.deviceId.length > 0
      ? ad.deviceId.join(", ")
      : "All Devices in Selected Locations";

  const hasSchedule = Boolean(
    ad.startDate ||
      ad.endDate ||
      ad.startTime ||
      ad.endTime ||
      (ad.days && ad.days.length > 0)
  );

  const isImage =
    ad.mediaType === "image" ||
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(ad.videoPath || "");

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg ${
              isImage
                ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                : "bg-blue-50 text-blue-600 border-blue-200"
            }`}
          >
            {isImage ? <FaImage /> : <FaFilm />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{ad.title}</h1>
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-blue-100 text-blue-700 uppercase font-semibold">
                {isImage ? "Image" : "Video"}
              </span>
              {ad.isFallback && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-100 text-amber-800 font-semibold">
                  Fallback Default
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Order #{ad.playOrder ?? 1} · Priority {ad.priority ?? 1}
              {isImage ? ` · Display ${ad.displayDuration ?? 10}s` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Advertisements"
            variant="slate"
            size="md"
            to="/advertisements"
          />
          <ActionIconButton
            icon={FaEdit}
            title="Edit Advertisement"
            variant="blue"
            size="md"
            to={`/advertisements/${id}/edit`}
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Media Preview Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            Media Preview
          </h2>
          {isImage ? (
            <img
              src={getMediaUrl(ad.videoPath)}
              alt={ad.title}
              className="w-full rounded-lg bg-black max-h-[450px] object-contain"
            />
          ) : (
            <video
              src={getMediaUrl(ad.videoPath)}
              controls
              className="w-full rounded-lg bg-black max-h-[450px]"
            />
          )}
        </div>

        {/* Metadata & Schedule */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2.5 text-sm">
            <h2 className="text-base font-bold text-slate-900 pb-2 mb-2 border-b border-slate-100">
              Targeting &amp; Signage Details
            </h2>
            <DetailRow label="Companies" value={companies} />
            <DetailRow label="Locations" value={locations} />
            <DetailRow label="Target Devices" value={devices} />
            <DetailRow label="Ticker Text" value={ad.tickerText} />
            <DetailRow label="Description" value={ad.description} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2.5 text-sm">
            <h2 className="text-base font-bold text-slate-900 pb-2 mb-2 border-b border-slate-100">
              Schedule Configuration
            </h2>
            {hasSchedule ? (
              <>
                <DetailRow
                  label="Date Range"
                  value={
                    ad.startDate || ad.endDate
                      ? `${
                          ad.startDate ? String(ad.startDate).slice(0, 10) : "Any"
                        } to ${
                          ad.endDate ? String(ad.endDate).slice(0, 10) : "Any"
                        }`
                      : "Any"
                  }
                />
                <DetailRow
                  label="Time Window"
                  value={
                    ad.startTime || ad.endTime
                      ? `${ad.startTime || "00:00"} – ${ad.endTime || "23:59"}`
                      : "All Day"
                  }
                />
                <DetailRow
                  label="Days"
                  value={
                    ad.days?.length > 0 ? ad.days.join(", ") : "Every Day"
                  }
                />
              </>
            ) : (
              <p className="text-slate-500 text-sm">
                No automatic schedule configured (manual or fallback playback).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const DetailRow = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
    <span className="text-slate-500 font-medium">{label}</span>
    <span className="text-slate-900 sm:text-right">{value || "—"}</span>
  </div>
);
