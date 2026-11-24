import React, { useEffect, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { useParams } from "react-router-dom";
import ActionIconButton from "../../components/ActionIconButton";
import { getAdvertisementById } from "../services/advertisement.api";
import AdvertisementForm from "./AdvertisementForm";

export default function AdvertisementEdit() {
  const { id } = useParams();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAd = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await getAdvertisementById(id);
        const data = res.data.data;

        const normalizedAd = {
          ...data,
          company_ids:
            data.company_ids?.map((c) =>
              typeof c === "string" ? c : c._id
            ) || [],
          location_ids:
            data.location_ids?.map((l) =>
              typeof l === "string" ? l : l._id
            ) || [],
          deviceIds: (data.deviceIds?.length
            ? data.deviceIds
            : data.deviceId || []
          ).map((d) => (typeof d === "string" ? d : d.deviceId)),
          startDate: data.startDate?.slice(0, 10),
          endDate: data.endDate?.slice(0, 10),
        };

        setAd(normalizedAd);
      } catch (err) {
        console.error("Error fetching advertisement:", err);
        setError(
          err?.response?.data?.message || "Failed to load advertisement"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAd();
  }, [id]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="h-[480px] bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !ad) {
    return (
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {error || "Advertisement not found."}
          </span>
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Advertisements"
            variant="slate"
            size="md"
            to="/advertisements"
          />
        </div>
      </div>
    );
  }

  return <AdvertisementForm initialData={ad} />;
}
