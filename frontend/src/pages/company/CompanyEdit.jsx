import React, { useEffect, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { useParams } from "react-router-dom";
import ActionIconButton from "../../components/ActionIconButton";
import { getCompanyById } from "../services/company.api";
import CompanyForm from "./CompanyForm";

const CompanyEdit = () => {
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
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="h-[480px] bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {error || "Company not found."}
          </span>
          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Companies"
            variant="slate"
            size="md"
            to="/companies"
          />
        </div>
      </div>
    );
  }

  return <CompanyForm initialData={company} />;
};

export default CompanyEdit;
