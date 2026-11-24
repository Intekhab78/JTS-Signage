import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaMapMarkerAlt, FaSave } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import ActionIconButton from "../../components/ActionIconButton";
import { useToast } from "../../context/ToastContext";
import { getCompanies } from "../services/company.api";
import { createLocation, updateLocation } from "../services/location.api";

const LABEL_CLS =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-600 mb-0.5";
const INPUT_CLS =
  "w-full h-[34px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

const LocationForm = ({ initialData = null }) => {
  const isEditMode = Boolean(initialData?._id);
  const navigate = useNavigate();
  const toast = useToast();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    company_id: initialData?.company_id?._id || "",
    name: initialData?.name || "",
    street: initialData?.address?.street || "",
    city: initialData?.address?.city || "",
    state: initialData?.address?.state || "",
    contactPerson: initialData?.contactPerson || "",
    phone: initialData?.phone || "",
  });

  useEffect(() => {
    getCompanies().then((res) => setCompanies(res.data.data || []));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const payload = {
      company_id: formData.company_id,
      name: formData.name,
      contactPerson: formData.contactPerson,
      phone: formData.phone,
      ...(initialData?.email ? { email: initialData.email } : {}),
      address: {
        ...(initialData?.address || {}),
        street: formData.street,
        city: formData.city,
        state: formData.state,
      },
    };

    try {
      if (isEditMode) {
        await updateLocation(initialData._id, payload);
        toast.success("Location updated");
      } else {
        await createLocation(payload);
        toast.success("Location created");
      }
      navigate("/locations");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-2.5">
      <form
        onSubmit={handleSubmit}
        className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
      >
        {/* Header Band */}
        <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
              <FaMapMarkerAlt className="text-sm" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate leading-tight">
                {isEditMode ? "Edit Location" : "Create Location"}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                Bind a branch venue to a company and record local site contacts
              </p>
            </div>
          </div>
        </div>

        <div className="p-3.5 space-y-2.5">
          {/* Panel 1: Location & Address */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Location &amp; Address
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className={LABEL_CLS}>Company *</label>
                <select
                  name="company_id"
                  required
                  value={formData.company_id}
                  onChange={handleChange}
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

              <Input
                label="Location Name *"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Head Office Lobby"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2 lg:col-span-2">
                <Input
                  label="Address"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  placeholder="Floor / building / street address"
                />
              </div>
              <Input
                label="City"
                name="city"
                value={formData.city}
                onChange={handleChange}
              />
              <Input
                label="State"
                name="state"
                value={formData.state}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Panel 2: Site Contact */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Site Contact
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                label="Contact Person"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                placeholder="On-site manager / technician"
              />
              <Input
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98765..."
              />
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
              to="/locations"
            />
            <ActionIconButton
              icon={FaSave}
              title={isEditMode ? "Update Location" : "Save Location"}
              variant="blue"
              size="sm"
              type="submit"
              disabled={loading}
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

export default LocationForm;
