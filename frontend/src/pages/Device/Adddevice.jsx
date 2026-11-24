import React, { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaChevronDown, FaSave, FaTv } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import { useToast } from "../../context/ToastContext";
import { getCompanies } from "../services/company.api";
import { getLocationsByCompany } from "../services/location.api";

const LABEL_CLS =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-600 mb-0.5";
const INPUT_CLS =
  "w-full h-[34px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

const AddDevice = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const returnTo = location.state?.returnTo || "/devices";

  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    deviceId: "",
    deviceName: "",
    company_id: "",
    location_id: [],
    status: "active",
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    getCompanies()
      .then((res) => setCompanies(res.data.data || []))
      .catch((err) => console.error("Failed to load companies:", err));
  }, []);

  useEffect(() => {
    if (formData.company_id) {
      getLocationsByCompany(formData.company_id)
        .then((res) => setLocations(res.data.data || []))
        .catch((err) => console.error("Failed to load locations:", err));
    } else {
      setLocations([]);
    }
  }, [formData.company_id]);

  useEffect(() => {
    if (!isEditMode) return;

    setLoading(true);
    api
      .get(`/devices/listbyid/${id}`)
      .then((res) => {
        const d = res.data.data;

        setFormData({
          deviceId: d.deviceId || "",
          deviceName: d.deviceName || "",
          company_id: d.company_id?._id || "",
          location_id: (d.location_id || []).map((l) => l?._id || l),
          status: d.status || "active",
        });
      })
      .catch((err) => {
        console.error("Failed to load device:", err);
        toast.error("Failed to load device data");
      })
      .finally(() => setLoading(false));
  }, [id, isEditMode, toast]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "company_id" && { location_id: [] }),
    }));
  };

  const selectedLocationNames = locations
    .filter((loc) => formData.location_id.includes(loc._id))
    .map((loc) => loc.name)
    .join(", ");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (isEditMode) {
        await api.put(`/devices/update/${id}`, formData);
        toast.success("Device updated successfully");
      } else {
        await api.post("/devices/create", formData);
        toast.success("Device added successfully");
      }

      navigate(returnTo);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-2.5">
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-2.5">
      <form
        onSubmit={handleSubmit}
        className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
      >
        {/* Header Band */}
        <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
              <FaTv className="text-sm" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate leading-tight">
                {isEditMode ? "Edit Device" : "Add New Device"}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                Assign display screen hardware to a company and location
              </p>
            </div>
          </div>
        </div>

        <div className="p-3.5 space-y-2.5">
          {/* Panel 1: Device Identity */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Device Identity
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div>
                <label className={LABEL_CLS}>Device ID *</label>
                <input
                  name="deviceId"
                  value={formData.deviceId}
                  onChange={handleChange}
                  required
                  disabled={isEditMode}
                  placeholder="e.g. TV-LOBBY-01"
                  className={`${INPUT_CLS} disabled:bg-slate-100 disabled:text-slate-500`}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Device Name *</label>
                <input
                  name="deviceName"
                  value={formData.deviceName}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Main Lobby Display"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={INPUT_CLS}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Panel 2: Assignment */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Assignment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className={LABEL_CLS}>Company *</label>
                <select
                  name="company_id"
                  value={formData.company_id}
                  onChange={handleChange}
                  required
                  className={INPUT_CLS}
                >
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative" ref={dropdownRef}>
                <label className={LABEL_CLS}>Locations (Multi-Select)</label>
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full h-[34px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span
                    className={`truncate ${
                      selectedLocationNames
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {formData.location_id.length > 0
                      ? selectedLocationNames || "Selected"
                      : "Select locations..."}
                  </span>
                  <FaChevronDown className="text-slate-400 text-xs shrink-0" />
                </button>

                {showDropdown && (
                  <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 max-h-60 overflow-auto shadow-lg z-20 p-1.5">
                    {locations.length === 0 ? (
                      <p className="p-2 text-sm text-slate-500">
                        No locations found for this company.
                      </p>
                    ) : (
                      locations.map((l) => {
                        const isChecked = formData.location_id.includes(l._id);

                        return (
                          <label
                            key={l._id}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50 cursor-pointer rounded"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setFormData((prev) => {
                                  const newLocations = isChecked
                                    ? prev.location_id.filter(
                                        (locId) => locId !== l._id
                                      )
                                    : [...prev.location_id, l._id];

                                  return {
                                    ...prev,
                                    location_id: newLocations,
                                  };
                                });
                              }}
                            />
                            <span className="truncate">{l.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Band */}
        <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">* Required fields</span>
          <div className="flex items-center gap-2">
            <ActionIconButton
              icon={FaArrowLeft}
              title="Cancel"
              variant="slate"
              size="sm"
              to={returnTo}
            />
            <ActionIconButton
              icon={FaSave}
              title={isEditMode ? "Update Device" : "Save Device"}
              variant="blue"
              size="sm"
              type="submit"
              disabled={submitting}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddDevice;
