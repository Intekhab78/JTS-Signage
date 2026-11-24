import React, { useEffect, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { useParams } from "react-router-dom";
import ActionIconButton from "../../components/ActionIconButton";
import { getLocationById } from "../services/location.api";
import LocationForm from "./LocationForm";

export default function LocationEdit() {
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
        setError(err?.response?.data?.message || "Failed to load location.")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="h-[400px] bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {error || "Location not found."}
          </span>
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Locations"
            variant="slate"
            size="md"
            to="/locations"
          />
        </div>
      </div>
    );
  }

  return <LocationForm initialData={location} />;
}
