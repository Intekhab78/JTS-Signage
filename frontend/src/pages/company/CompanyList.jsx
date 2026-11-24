import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  FaBuilding,
  FaEdit,
  FaEye,
  FaPlus,
  FaSearch,
  FaSyncAlt,
  FaTrash,
} from "react-icons/fa";
import ActionIconButton from "../../components/ActionIconButton";
import Pagination from "../../components/Pagination";
import { AuthContext } from "../../contextAuth/AuthContext";
import { useToast } from "../../context/ToastContext";
import { deleteCompany, getCompanies } from "../services/company.api";

const CompanyList = () => {
  const toast = useToast();
  const { user } = useContext(AuthContext);
  const isSuperAdmin = user?.role === "admin";

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCompanies();
      setCompanies(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch companies:", err);
      setError(err?.response?.data?.message || "Failed to load companies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this company?")) return;
    try {
      await deleteCompany(id);
      toast.success("Company deleted successfully");
      fetchCompanies();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete company");
    }
  };

  const industries = useMemo(() => {
    const set = new Set(
      companies.map((c) => c.industry?.trim()).filter(Boolean)
    );
    return Array.from(set).sort();
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      const matchesQuery =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.address?.city?.toLowerCase().includes(q);
      const matchesIndustry =
        !industryFilter || c.industry?.trim() === industryFilter;
      return matchesQuery && matchesIndustry;
    });
  }, [companies, search, industryFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCompanies.length / itemsPerPage)
  );
  const safePage = Math.min(page, totalPages);
  const paginatedCompanies = useMemo(() => {
    return filteredCompanies.slice(
      (safePage - 1) * itemsPerPage,
      safePage * itemsPerPage
    );
  }, [filteredCompanies, safePage]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-6 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-slate-200 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{error}</span>
          <ActionIconButton
            icon={FaSyncAlt}
            title="Retry"
            variant="red"
            onClick={fetchCompanies}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <FaBuilding />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Companies ({filteredCompanies.length})
            </h1>
            <p className="text-xs text-slate-500">
              Manage client organizations and primary contacts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, city, email..."
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={industryFilter}
            onChange={(e) => {
              setIndustryFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>

          <ActionIconButton
            icon={FaSyncAlt}
            title="Refresh Companies"
            variant="slate"
            size="md"
            onClick={fetchCompanies}
          />

          {isSuperAdmin && (
            <ActionIconButton
              icon={FaPlus}
              title="Add Company"
              variant="blue"
              size="md"
              to="/companies/new"
            />
          )}
        </div>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500 text-sm">
          No companies found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
            <table className="w-full border-collapse min-w-[720px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3.5 text-left">Company</th>
                  <th className="p-3.5 text-left">Industry</th>
                  <th className="p-3.5 text-left">Contact</th>
                  <th className="p-3.5 text-left">City / State</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCompanies.map((c) => (
                  <tr
                    key={c._id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="p-3.5">
                      <p className="font-semibold text-slate-900">{c.name}</p>
                    </td>
                    <td className="p-3.5 text-slate-700">
                      {c.industry ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-medium">
                          {c.industry}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3.5 text-xs text-slate-600">
                      <p>{c.email || "—"}</p>
                      <p className="text-slate-400">{c.phone || ""}</p>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {[c.address?.city, c.address?.state]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <ActionIconButton
                          icon={FaEye}
                          title="View Company Details"
                          variant="blue"
                          to={`/companies/${c._id}`}
                        />
                        <ActionIconButton
                          icon={FaEdit}
                          title="Edit Company"
                          variant="green"
                          to={`/companies/${c._id}/edit`}
                        />
                        {isSuperAdmin && (
                          <ActionIconButton
                            icon={FaTrash}
                            title="Delete Company"
                            variant="red"
                            onClick={() => handleDelete(c._id)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalItems={filteredCompanies.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
            itemLabel="companies"
          />
        </>
      )}
    </div>
  );
};

export default CompanyList;
