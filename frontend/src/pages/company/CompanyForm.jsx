import React, { useState } from "react";
import { FaArrowLeft, FaBuilding, FaSave } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import { useToast } from "../../context/ToastContext";

const LABEL_CLS =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-600 mb-0.5";
const INPUT_CLS =
  "w-full h-[34px] border border-slate-300 rounded-lg px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

const CompanyForm = ({ initialData = null }) => {
  const isEditMode = Boolean(initialData?._id);
  const navigate = useNavigate();
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    industry: initialData?.industry || "",
    description: initialData?.description || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    address: {
      street: initialData?.address?.street || "",
      city: initialData?.address?.city || "",
      state: initialData?.address?.state || "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg("");

    const payload = {
      ...formData,
      address: {
        ...(initialData?.address || {}),
        ...formData.address,
      },
    };

    try {
      if (isEditMode) {
        await api.put(`/company/edit/${initialData._id}`, payload);
        toast.success("Company updated successfully");
      } else {
        await api.post("/company/create", payload);
        toast.success("Company created successfully");
      }

      navigate("/companies");
    } catch (error) {
      const msg = error?.response?.data?.message || "Something went wrong";
      setErrorMsg(msg);
      toast.error(msg);
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
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
              <FaBuilding className="text-sm" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate leading-tight">
                {isEditMode ? "Edit Company" : "Create Company"}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                Configure organization identity and primary contact details
              </p>
            </div>
          </div>
        </div>

        <div className="p-3.5 space-y-2.5">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Panel 1: Basic Details */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Basic Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                label="Company Name *"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Jts Group"
              />
              <Input
                label="Industry"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                placeholder="e.g. Retail, Corporate, Mall"
              />
            </div>

            <Textarea
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional short note about this organization"
            />
          </div>

          {/* Panel 2: Contact & Address */}
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/40 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Contact &amp; Address
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@company.com"
              />
              <Input
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98765..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2 lg:col-span-2">
                <Input
                  label="Address"
                  name="address.street"
                  value={formData.address.street}
                  onChange={handleChange}
                  placeholder="Head office / building address"
                />
              </div>
              <Input
                label="City"
                name="address.city"
                value={formData.address.city}
                onChange={handleChange}
              />
              <Input
                label="State"
                name="address.state"
                value={formData.address.state}
                onChange={handleChange}
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
              to="/companies"
            />
            <ActionIconButton
              icon={FaSave}
              title={isEditMode ? "Update Company" : "Create Company"}
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

export default CompanyForm;
