import React, { useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaChevronDown,
  FaCloudUploadAlt,
  FaFilm,
  FaPlus,
  FaSave,
  FaTimes,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import { useToast } from "../../context/ToastContext";
import { getMediaUrl } from "../../utils/mediaUrl";
import {
  createAdvertisement,
  updateAdvertisement,
} from "../services/advertisement.api";
import { getCompanies } from "../services/company.api";
import { getLocationsByCompany } from "../services/location.api";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const LABEL_CLS =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-600 mb-0.5";
const INPUT_CLS =
  "w-full h-[34px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

const AdvertisementForm = ({ initialData = null }) => {
  const isEditMode = Boolean(initialData?._id);
  const navigate = useNavigate();
  const toast = useToast();

  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef(null);
  const companyDropdownRef = useRef(null);
  const locationDropdownRef = useRef(null);
  const deviceDropdownRef = useRef(null);

  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const [locationSearch, setLocationSearch] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  const [devices, setDevices] = useState([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const filteredLocations = locations.filter((l) =>
    l.name.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const [formData, setFormData] = useState({
    company_ids: initialData?.company_ids || [],
    location_ids: initialData?.location_ids || [],
    deviceIds: initialData?.deviceIds || initialData?.deviceId || [],
    title: initialData?.title || "",
    description: initialData?.description || "",
    playOrder: initialData?.playOrder || 1,
    displayDuration: initialData?.displayDuration || 10,
    tickerText: initialData?.tickerText || "",
    priority: initialData?.priority || 1,
    isFallback: Boolean(initialData?.isFallback),
    startDate: initialData?.startDate
      ? String(initialData.startDate).slice(0, 10)
      : "",
    endDate: initialData?.endDate
      ? String(initialData.endDate).slice(0, 10)
      : "",
    startTime: initialData?.startTime || "",
    endTime: initialData?.endTime || "",
    days: initialData?.days || [],
  });

  useEffect(() => {
    if (!videoFile) {
      setLocalPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        companyDropdownRef.current &&
        !companyDropdownRef.current.contains(event.target)
      ) {
        setShowCompanyDropdown(false);
      }
      if (
        locationDropdownRef.current &&
        !locationDropdownRef.current.contains(event.target)
      ) {
        setShowLocationDropdown(false);
      }
      if (
        deviceDropdownRef.current &&
        !deviceDropdownRef.current.contains(event.target)
      ) {
        setShowDeviceDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    getCompanies().then((res) => setCompanies(res.data.data || []));
  }, []);

  useEffect(() => {
    if (!formData.company_ids.length) {
      setLocations([]);
      return;
    }

    Promise.all(
      formData.company_ids.map((id) => getLocationsByCompany(id))
    ).then((responses) => {
      const all = responses.flatMap((r) => r.data.data || []);
      setLocations(all);
    });
  }, [formData.company_ids]);

  useEffect(() => {
    if (!formData.location_ids?.length) {
      setDevices([]);
      return;
    }

    api
      .get("/devices/list")
      .then((res) => {
        const filtered = (res.data.data || []).filter((d) =>
          d.location_id?.some((loc) =>
            formData.location_ids.includes(loc._id)
          )
        );
        setDevices(filtered);
      })
      .catch((err) => console.error("Device fetch error:", err));
  }, [formData.location_ids]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const filteredDevices = devices.filter(
    (d) =>
      d.deviceId.toLowerCase().includes(deviceSearch.toLowerCase()) ||
      d.deviceName?.toLowerCase().includes(deviceSearch.toLowerCase())
  );

  const toggleCompany = (id) => {
    setFormData((prev) => {
      const exists = prev.company_ids.includes(id);
      return {
        ...prev,
        company_ids: exists
          ? prev.company_ids.filter((x) => x !== id)
          : [...prev.company_ids, id],
        location_ids: [],
        deviceIds: [],
      };
    });
    setShowCompanyDropdown(false);
  };

  const toggleLocation = (id) => {
    setFormData((prev) => {
      const exists = prev.location_ids.includes(id);
      return {
        ...prev,
        location_ids: exists
          ? prev.location_ids.filter((x) => x !== id)
          : [...prev.location_ids, id],
        deviceIds: [],
      };
    });
  };

  const toggleDevice = (deviceId) => {
    setFormData((prev) => {
      const exists = prev.deviceIds.includes(deviceId);
      return {
        ...prev,
        deviceIds: exists
          ? prev.deviceIds.filter((x) => x !== deviceId)
          : [...prev.deviceIds, deviceId],
      };
    });
  };

  const toggleDay = (day) => {
    setFormData((prev) => {
      const exists = prev.days.includes(day);
      return {
        ...prev,
        days: exists
          ? prev.days.filter((d) => d !== day)
          : [...prev.days, day],
      };
    });
  };

  const handleMediaPick = (file) => {
    if (!file) return;
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      toast.error("Only video or image files are supported");
      return;
    }
    setVideoFile(file);
  };

  const handleClearMedia = () => {
    setVideoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!formData.company_ids.length) {
      toast.error("Please select at least one company");
      return;
    }

    if (!formData.location_ids.length) {
      toast.error("Please select at least one location");
      return;
    }

    if (!isEditMode && !videoFile) {
      toast.error("Please select a video or image file");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    const payload = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (["company_ids", "location_ids", "deviceIds", "days"].includes(key)) {
        payload.append(key, JSON.stringify(value));
      } else {
        payload.append(key, value);
      }
    });

    if (videoFile) {
      payload.append("video", videoFile);
    }

    const onUploadProgress = (progressEvent) => {
      if (progressEvent.total) {
        const pct = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setUploadProgress(pct);
      }
    };

    try {
      if (isEditMode) {
        await updateAdvertisement(initialData._id, payload, onUploadProgress);
        toast.success("Advertisement updated successfully");
      } else {
        await createAdvertisement(payload, onUploadProgress);
        toast.success("Advertisement created successfully");
      }
      navigate("/advertisements");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showCompanyDropdown) setCompanySearch("");
  }, [showCompanyDropdown]);

  useEffect(() => {
    if (!showLocationDropdown) setLocationSearch("");
  }, [showLocationDropdown]);

  useEffect(() => {
    if (!showDeviceDropdown) setDeviceSearch("");
  }, [showDeviceDropdown]);

  const existingIsImage =
    initialData?.mediaType === "image" ||
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(initialData?.videoPath || "");

  const pickedIsImage = videoFile?.type?.startsWith("image/");

  const selectedCompaniesLabel = companies
    .filter((c) => formData.company_ids.includes(c._id))
    .map((c) => c.name)
    .join(", ");

  const selectedLocationsLabel = locations
    .filter((l) => formData.location_ids.includes(l._id))
    .map((l) => l.name)
    .join(", ");

  const hasPreview = Boolean(
    localPreviewUrl || (isEditMode && initialData?.videoPath)
  );
  const showImagePreview = localPreviewUrl ? pickedIsImage : existingIsImage;
  const previewSrc = localPreviewUrl || getMediaUrl(initialData?.videoPath);

  return (
    <div className="w-full px-4 sm:px-6 py-2.5">
      <form
        className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
      >
        {/* Header Band */}
        <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
              <FaFilm className="text-sm" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate leading-tight">
                {isEditMode ? "Edit Advertisement" : "Create Advertisement"}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                Target companies, locations, TV devices, media files, and
                schedules
              </p>
            </div>
          </div>
        </div>

        <div className="p-3.5 space-y-2.5">
          {/* Panel 1: Target Screens */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Target Screens
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* COMPANY MULTI SELECT */}
              <div className="relative" ref={companyDropdownRef}>
                <label className={LABEL_CLS}>Companies *</label>
                <button
                  type="button"
                  onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                  className="w-full h-[34px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span
                    className={`truncate ${
                      selectedCompaniesLabel
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {selectedCompaniesLabel || "Select companies..."}
                  </span>
                  <FaChevronDown className="text-slate-400 text-xs shrink-0" />
                </button>

                {showCompanyDropdown && (
                  <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 max-h-60 overflow-auto shadow-lg z-20 p-2">
                    <input
                      type="text"
                      placeholder="Search company..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="w-full h-8 border border-slate-300 rounded px-2 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    {filteredCompanies.length > 0 ? (
                      filteredCompanies.map((c) => {
                        const checked = formData.company_ids.includes(c._id);
                        return (
                          <label
                            key={c._id}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50 cursor-pointer rounded"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCompany(c._id)}
                            />
                            <span className="truncate">{c.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="text-center py-2 space-y-2">
                        <p className="text-xs text-slate-500">
                          No company found
                        </p>
                        <ActionIconButton
                          icon={FaPlus}
                          title="Add Company"
                          variant="blue"
                          onClick={() => navigate("/companies/new")}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* LOCATION MULTI SELECT */}
              <div className="relative" ref={locationDropdownRef}>
                <label className={LABEL_CLS}>Locations *</label>
                <button
                  type="button"
                  onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                  className="w-full h-[34px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span
                    className={`truncate ${
                      selectedLocationsLabel
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {selectedLocationsLabel || "Select locations..."}
                  </span>
                  <FaChevronDown className="text-slate-400 text-xs shrink-0" />
                </button>

                {showLocationDropdown && (
                  <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 max-h-60 overflow-auto shadow-lg z-20 p-2">
                    <input
                      type="text"
                      placeholder="Search location..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="w-full h-8 border border-slate-300 rounded px-2 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    {filteredLocations.length > 0 ? (
                      filteredLocations.map((l) => {
                        const checked = formData.location_ids.includes(l._id);
                        return (
                          <label
                            key={l._id}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50 cursor-pointer rounded"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLocation(l._id)}
                            />
                            <span className="truncate">{l.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="text-center py-2 space-y-2">
                        <p className="text-xs text-slate-500">
                          No location found
                        </p>
                        <ActionIconButton
                          icon={FaPlus}
                          title="Add Location"
                          variant="blue"
                          onClick={() => navigate("/locations/new")}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* DEVICE MULTI SELECT */}
              <div className="relative" ref={deviceDropdownRef}>
                <label className={LABEL_CLS}>Devices (Optional)</label>
                <button
                  type="button"
                  onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                  className="w-full h-[34px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span
                    className={`truncate ${
                      formData.deviceIds.length > 0
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {formData.deviceIds.length > 0
                      ? formData.deviceIds.join(", ")
                      : "All devices in selected locations"}
                  </span>
                  <FaChevronDown className="text-slate-400 text-xs shrink-0" />
                </button>

                {showDeviceDropdown && (
                  <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 max-h-60 overflow-auto shadow-lg z-20 p-2">
                    <input
                      type="text"
                      placeholder="Search device..."
                      value={deviceSearch}
                      onChange={(e) => setDeviceSearch(e.target.value)}
                      className="w-full h-8 border border-slate-300 rounded px-2 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    {filteredDevices.length > 0 ? (
                      filteredDevices.map((d) => {
                        const isChecked = formData.deviceIds.includes(
                          d.deviceId
                        );
                        return (
                          <label
                            key={d._id}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50 cursor-pointer rounded"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleDevice(d.deviceId)}
                            />
                            <span className="truncate">
                              {d.deviceId} — {d.deviceName}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="text-center py-2 space-y-2">
                        <p className="text-xs text-slate-500">
                          No device found
                        </p>
                        <ActionIconButton
                          icon={FaPlus}
                          title="Add Device"
                          variant="blue"
                          onClick={() =>
                            navigate("/add-device", {
                              state: { returnTo: window.location.pathname },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel 2: Campaign & Media */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Campaign &amp; Media
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
              {/* Left: Inputs */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    label="Advertisement Title *"
                    name="title"
                    required
                    placeholder="e.g. Summer Festive Promo"
                    value={formData.title}
                    onChange={handleChange}
                  />
                  <Input
                    label="Scrolling Ticker Text (Optional)"
                    name="tickerText"
                    placeholder="Defaults to title if blank"
                    value={formData.tickerText}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                  <Input
                    label="Play Order"
                    name="playOrder"
                    type="number"
                    min="1"
                    value={formData.playOrder}
                    onChange={handleChange}
                  />
                  <Input
                    label="Priority"
                    name="priority"
                    type="number"
                    min="1"
                    value={formData.priority}
                    onChange={handleChange}
                  />
                  <Input
                    label="Image Sec"
                    name="displayDuration"
                    type="number"
                    min="1"
                    value={formData.displayDuration}
                    onChange={handleChange}
                  />
                  <div>
                    <label className={LABEL_CLS}>Fallback Mode</label>
                    <label
                      title="Plays when no scheduled ad is active"
                      className={`h-[34px] px-2.5 rounded-lg border flex items-center gap-2 cursor-pointer text-sm transition ${
                        formData.isFallback
                          ? "bg-amber-50 border-amber-300 text-amber-900"
                          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="isFallback"
                        checked={formData.isFallback}
                        onChange={handleChange}
                        className="rounded"
                      />
                      <span className="font-medium truncate">Default Ad</span>
                    </label>
                  </div>
                </div>

                <Textarea
                  label="Description"
                  name="description"
                  placeholder="Optional campaign notes..."
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              {/* Right: Media Dropzone / Preview */}
              <div className="lg:col-span-5 flex flex-col">
                <label className={LABEL_CLS}>
                  Media File (Video or Image){" "}
                  {isEditMode ? "(Optional)" : "*"}
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*"
                  onChange={(e) => handleMediaPick(e.target.files?.[0])}
                  className="hidden"
                />

                {!hasPreview ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleMediaPick(e.dataTransfer.files?.[0]);
                    }}
                    className={`flex-1 min-h-[144px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition ${
                      dragOver
                        ? "border-blue-500 bg-blue-50/60"
                        : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/60"
                    }`}
                  >
                    <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5">
                      <FaCloudUploadAlt className="text-lg" />
                    </span>
                    <p className="text-sm font-semibold text-slate-800">
                      Click or drop video / image
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      MP4, WebM, JPG, PNG, WebP
                    </p>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleMediaPick(e.dataTransfer.files?.[0]);
                    }}
                    className={`flex-1 min-h-[144px] border-2 border-dashed rounded-xl bg-white flex flex-col justify-between p-2.5 transition ${
                      dragOver ? "border-blue-500 bg-blue-50/40" : "border-slate-300"
                    }`}
                  >
                    <div className="flex-1 flex items-center justify-center">
                      {showImagePreview ? (
                        <img
                          src={previewSrc}
                          alt={initialData?.title || "Media preview"}
                          className="max-h-28 w-full object-contain rounded-lg bg-black"
                        />
                      ) : (
                        <video
                          src={previewSrc}
                          controls
                          className="max-h-28 w-full rounded-lg bg-black"
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 mt-1.5 border-t border-slate-100">
                      <span className="text-xs font-medium text-slate-600 truncate">
                        {videoFile?.name || "Current Media"}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <ActionIconButton
                          icon={FaCloudUploadAlt}
                          title="Replace Media File"
                          variant="blue"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        />
                        {videoFile && (
                          <ActionIconButton
                            icon={FaTimes}
                            title="Clear Selected File"
                            variant="red"
                            size="sm"
                            onClick={handleClearMedia}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel 3: Schedule */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Schedule (Optional)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Input
                label="Start Date"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
              />
              <Input
                label="End Date"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleChange}
              />
              <Input
                label="Start Time"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={handleChange}
              />
              <Input
                label="End Time"
                name="endTime"
                type="time"
                value={formData.endTime}
                onChange={handleChange}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 mr-1">
                Days of Week
              </span>
              {DAYS_OF_WEEK.map((day) => {
                const active = formData.days.includes(day);
                return (
                  <label
                    key={day}
                    title={day}
                    className={`inline-flex items-center text-xs cursor-pointer px-2.5 py-1 border rounded-lg transition ${
                      active
                        ? "bg-blue-50 text-blue-700 border-blue-300 font-semibold"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleDay(day)}
                      className="sr-only"
                    />
                    {day.slice(0, 3)}
                  </label>
                );
              })}
            </div>
          </div>

          {submitting && videoFile && (
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Uploading media...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
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
              to="/advertisements"
            />
            <ActionIconButton
              icon={FaSave}
              title={isEditMode ? "Update Advertisement" : "Save Advertisement"}
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

const Input = ({ label, ...props }) => (
  <div>
    <label className={LABEL_CLS}>{label}</label>
    <input {...props} className={INPUT_CLS} />
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div>
    <label className={LABEL_CLS}>{label}</label>
    <textarea
      {...props}
      rows="1"
      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

export default AdvertisementForm;
