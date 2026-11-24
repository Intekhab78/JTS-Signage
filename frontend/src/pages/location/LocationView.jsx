import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaEdit, FaMapMarkerAlt } from "react-icons/fa";
import { useParams } from "react-router-dom";
import ActionIconButton from "../../components/ActionIconButton";
import { getLocationById } from "../services/location.api";

export default function LocationView() {
  const { id } = useParams();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getLocationById(id)
      .then((res) => setLocation(res.data.data))
      .catch((err) =>
        setError(err?.response?.data?.message || "Failed to load location")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="h-56 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span>{error || "Location not found."}</span>
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Locations"
            variant="slate"
            to="/locations"
          />
        </div>
      </div>
    );
  }

  const addr = location.address || {};
  const fullAddress = [
    addr.street,
    addr.city,
    addr.state,
    addr.country,
    addr.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center text-lg">
            <FaMapMarkerAlt />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {location.name}
            </h1>
            <p className="text-xs text-slate-500">
              Company: {location.company_id?.name || "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Locations"
            variant="slate"
            size="md"
            to="/locations"
          />
          <ActionIconButton
            icon={FaEdit}
            title="Edit Location"
            variant="blue"
            size="md"
            to={`/locations/${id}/edit`}
          />
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2.5 text-sm">
          <h2 className="text-base font-bold text-slate-900 pb-2 mb-2 border-b border-slate-100">
            Location &amp; Site Contact
          </h2>
          <Row label="Location Name" value={location.name} />
          <Row label="Company" value={location.company_id?.name} />
          <Row label="Contact Person" value={location.contactPerson} />
          <Row label="Phone" value={location.phone} />
          {location.email && <Row label="Email" value={location.email} />}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2.5 text-sm">
          <h2 className="text-base font-bold text-slate-900 pb-2 mb-2 border-b border-slate-100">
            Address Details
          </h2>
          <Row label="Address" value={addr.street} />
          <Row label="City" value={addr.city} />
          <Row label="State" value={addr.state} />
          <Row label="Full Address" value={fullAddress} />
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
    <span className="text-slate-500 font-medium">{label}</span>
    <span className="text-slate-900 sm:text-right">{value || "—"}</span>
  </div>
);
