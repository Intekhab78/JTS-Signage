import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaBuilding, FaEdit } from "react-icons/fa";
import { useParams } from "react-router-dom";
import ActionIconButton from "../../components/ActionIconButton";
import { getCompanyById } from "../services/company.api";

const CompanyView = () => {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getCompanyById(id)
      .then((res) => setCompany(res.data.data))
      .catch((err) =>
        setError(err?.response?.data?.message || "Failed to load company.")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span>{error || "Company not found."}</span>
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Companies"
            variant="slate"
            to="/companies"
          />
        </div>
      </div>
    );
  }

  const fullAddress = [
    company.address?.street,
    company.address?.city,
    company.address?.state,
    company.address?.country,
    company.address?.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center text-lg">
            <FaBuilding />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {company.name}
            </h1>
            <p className="text-xs text-slate-500">
              {company.industry || "Digital Signage Organization"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Companies"
            variant="slate"
            size="md"
            to="/companies"
          />
          <ActionIconButton
            icon={FaEdit}
            title="Edit Company"
            variant="blue"
            size="md"
            to={`/companies/${id}/edit`}
          />
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DetailCard title="Basic Information">
          <DetailRow label="Company Name" value={company.name} />
          <DetailRow label="Industry" value={company.industry} />
          <DetailRow label="Description" value={company.description} />
          {company.notes && <DetailRow label="Notes" value={company.notes} />}
        </DetailCard>

        <DetailCard title="Contact & Address">
          <DetailRow label="Email" value={company.email} />
          <DetailRow label="Phone" value={company.phone} />
          <DetailRow label="Address" value={fullAddress} />
        </DetailCard>
      </div>
    </div>
  );
};

const DetailCard = ({ title, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
    <h2 className="text-base font-bold text-slate-900 pb-2 mb-3 border-b border-slate-100">
      {title}
    </h2>
    <div className="space-y-2.5 text-sm">{children}</div>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
    <span className="text-slate-500 font-medium">{label}</span>
    <span className="text-slate-900 sm:text-right">{value || "—"}</span>
  </div>
);

export default CompanyView;
