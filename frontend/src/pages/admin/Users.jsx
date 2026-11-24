import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaBuilding,
  FaCheck,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaPlus,
  FaSave,
  FaSearch,
  FaSyncAlt,
  FaTimes,
  FaUserPlus,
  FaUsers,
  FaUserShield,
} from "react-icons/fa";
import api from "../../api/axios";
import ActionIconButton from "../../components/ActionIconButton";
import Pagination from "../../components/Pagination";
import { useToast } from "../../context/ToastContext";
import { getCompanies } from "../services/company.api";

const EMPTY_CLIENT_FORM = {
  name: "",
  email: "",
  password: "",
  role: "company_admin",
  companyMode: "new",
  company_id: "",
  newCompanyName: "",
  companyIndustry: "",
  companyPhone: "",
};

export default function Users() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Quick Create Company Modal state (for an existing pending/selected user)
  const [companyModalUser, setCompanyModalUser] = useState(null);
  const [quickCompanyForm, setQuickCompanyForm] = useState({
    name: "",
    industry: "",
    phone: "",
  });
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Add New Client Account Modal state
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);

  const normalizeAssignableRole = (role) =>
    role === "company_admin" ? "company_admin" : "customer";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, compRes] = await Promise.all([
        api.get("/admin/users"),
        getCompanies(),
      ]);
      const list = usersRes.data || [];
      setUsers(list);
      setCompanies(compRes.data.data || []);

      const initialDrafts = {};
      list.forEach((u) => {
        initialDrafts[u._id] = {
          role:
            u.role === "admin"
              ? "admin"
              : normalizeAssignableRole(u.role),
          company_id: u.company_id?._id || u.company_id || "",
        };
      });
      setDrafts(initialDrafts);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const adminCountByCompany = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.role !== "company_admin") return;
      const cid = String(u.company_id?._id || u.company_id || "");
      if (!cid) return;
      map[cid] = (map[cid] || 0) + 1;
    });
    return map;
  }, [users]);

  const formatCompanyOption = (c) => {
    const count = adminCountByCompany[String(c._id)] || 0;
    if (count === 0) return `${c.name} (Unassigned)`;
    return `${c.name} (${count} admin${count === 1 ? "" : "s"})`;
  };

  const handleSaveUser = async (userId) => {
    const draft = drafts[userId];
    if (!draft || draft.role === "admin") return;

    if (draft.role === "company_admin" && !draft.company_id) {
      toast.error("Select a company or click '+ New' to create one");
      return;
    }

    setSavingId(userId);
    try {
      await api.put(`/admin/users/${userId}`, {
        role: draft.role,
        company_id:
          draft.role === "company_admin" ? draft.company_id : undefined,
      });
      toast.success("User access updated");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update user");
    } finally {
      setSavingId(null);
    }
  };

  const handleQuickCreateAndApprove = async (userObj) => {
    const reqName = String(userObj?.requestedCompanyName || "").trim();
    if (!userObj?._id || !reqName) return;

    setSavingId(userObj._id);
    try {
      await api.put(`/admin/users/${userObj._id}`, {
        role: "company_admin",
        newCompanyName: reqName,
      });
      toast.success(
        `Created "${reqName}" and granted Company Admin access to ${userObj.name || userObj.email}`
      );
      loadData();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to create & approve company"
      );
    } finally {
      setSavingId(null);
    }
  };

  const openQuickCompanyModal = (userObj) => {
    setCompanyModalUser(userObj);
    setQuickCompanyForm({
      name: userObj?.requestedCompanyName || "",
      industry: "",
      phone: "",
    });
  };

  const handleSubmitQuickCompany = async (e) => {
    e.preventDefault();
    if (!companyModalUser || creatingCompany) return;

    const trimmedName = quickCompanyForm.name.trim();
    if (!trimmedName) {
      toast.error("Company name is required");
      return;
    }

    setCreatingCompany(true);
    try {
      await api.put(`/admin/users/${companyModalUser._id}`, {
        role: "company_admin",
        newCompanyName: trimmedName,
        companyIndustry: quickCompanyForm.industry.trim(),
        companyPhone: quickCompanyForm.phone.trim(),
      });
      toast.success(
        `Created "${trimmedName}" and assigned to ${companyModalUser.name || companyModalUser.email}`
      );
      setCompanyModalUser(null);
      loadData();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to create & assign company"
      );
    } finally {
      setCreatingCompany(false);
    }
  };

  const openAddClientModal = () => {
    setClientForm(EMPTY_CLIENT_FORM);
    setShowClientPassword(false);
    setShowAddClientModal(true);
  };

  const handleSubmitAddClient = async (e) => {
    e.preventDefault();
    if (creatingClient) return;

    if (!clientForm.name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!clientForm.email.trim()) {
      toast.error("Email address is required");
      return;
    }
    if (clientForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    const payload = {
      name: clientForm.name.trim(),
      email: clientForm.email.trim(),
      password: clientForm.password,
      role: clientForm.role,
    };

    if (clientForm.role === "company_admin") {
      if (clientForm.companyMode === "new") {
        if (!clientForm.newCompanyName.trim()) {
          toast.error("Company name is required");
          return;
        }
        payload.newCompanyName = clientForm.newCompanyName.trim();
        payload.companyIndustry = clientForm.companyIndustry.trim();
        payload.companyPhone = clientForm.companyPhone.trim();
      } else {
        if (!clientForm.company_id) {
          toast.error("Select an existing company");
          return;
        }
        payload.company_id = clientForm.company_id;
      }
    }

    setCreatingClient(true);
    try {
      const res = await api.post("/admin/users", payload);
      toast.success(res.data?.message || "Client account created successfully");
      setShowAddClientModal(false);
      loadData();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to create client account"
      );
    } finally {
      setCreatingClient(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.requestedCompanyName?.toLowerCase().includes(q);
      const effectiveRole =
        u.role === "admin" ? "admin" : normalizeAssignableRole(u.role);
      const matchesRole = !roleFilter || effectiveRole === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(
      (safePage - 1) * itemsPerPage,
      safePage * itemsPerPage
    );
  }, [filteredUsers, safePage]);

  const counts = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      companyAdmins: users.filter((u) => u.role === "company_admin").length,
      pending: users.filter(
        (u) => u.role !== "admin" && u.role !== "company_admin"
      ).length,
    };
  }, [users]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-6 space-y-4">
        <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            User Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Approve pending signups, create client workspaces, or manage access
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ActionIconButton
            icon={FaSyncAlt}
            title="Refresh Users"
            variant="slate"
            size="md"
            onClick={loadData}
          />
          <button
            type="button"
            onClick={openAddClientModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition"
          >
            <FaUserPlus className="text-xs" />
            Add Client
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Users" value={counts.total} icon={FaUsers} />
        <SummaryCard
          title="Super Admins"
          value={counts.admins}
          icon={FaUserShield}
        />
        <SummaryCard
          title="Company Admins"
          value={counts.companyAdmins}
          icon={FaBuilding}
        />
        <SummaryCard
          title="Pending / No Access"
          value={counts.pending}
          icon={FaUsers}
        />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or requested company..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white sm:w-56"
        >
          <option value="">All Roles</option>
          <option value="admin">Super Admin (Owner)</option>
          <option value="company_admin">Company Admin</option>
          <option value="customer">No Access (Pending)</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full border-collapse min-w-[820px] text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3.5 text-left">User</th>
              <th className="p-3.5 text-left">Email</th>
              <th className="p-3.5 text-left">Role</th>
              <th className="p-3.5 text-left">Assigned Company</th>
              <th className="p-3.5 text-center">Save</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((u) => {
              const isSuperAdmin = u.role === "admin";
              const draft = drafts[u._id] || {
                role: isSuperAdmin ? "admin" : normalizeAssignableRole(u.role),
                company_id: u.company_id?._id || u.company_id || "",
              };
              const initials = (u.name || u.email || "U")
                .slice(0, 2)
                .toUpperCase();
              const hasRequestedCompany =
                Boolean(u.requestedCompanyName) && !u.company_id;

              return (
                <tr
                  key={u._id}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                >
                  <td className="p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 block">
                          {u.name || "—"}
                        </span>
                        {hasRequestedCompany && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                              Requested: {u.requestedCompanyName}
                            </span>
                            <button
                              type="button"
                              disabled={savingId === u._id}
                              onClick={() => handleQuickCreateAndApprove(u)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-semibold transition"
                            >
                              <FaCheck className="text-[9px]" />
                              Create &amp; Approve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 text-slate-600">{u.email}</td>
                  <td className="p-3.5">
                    {isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                        <FaUserShield className="text-xs" />
                        Super Admin (Owner)
                      </span>
                    ) : (
                      <select
                        value={draft.role}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [u._id]: {
                              ...prev[u._id],
                              role: e.target.value,
                            },
                          }))
                        }
                        className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="company_admin">Company Admin</option>
                        <option value="customer">No Access (Pending)</option>
                      </select>
                    )}
                  </td>
                  <td className="p-3.5">
                    {isSuperAdmin ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                        All Companies (Full Access)
                      </span>
                    ) : draft.role === "company_admin" ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={draft.company_id}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [u._id]: {
                                ...prev[u._id],
                                company_id: e.target.value,
                              },
                            }))
                          }
                          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm flex-1 min-w-[180px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Company</option>
                          {companies.map((c) => (
                            <option key={c._id} value={c._id}>
                              {formatCompanyOption(c)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title="Create New Company for this user"
                          onClick={() => openQuickCompanyModal(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold whitespace-nowrap transition"
                        >
                          <FaPlus className="text-[10px]" />
                          New
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        No company assigned
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    {isSuperAdmin ? (
                      <span
                        title="System Owner role is locked"
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-medium"
                      >
                        <FaLock className="text-[10px]" /> Locked
                      </span>
                    ) : (
                      <ActionIconButton
                        icon={FaSave}
                        title="Save User Role"
                        variant="blue"
                        disabled={savingId === u._id}
                        onClick={() => handleSaveUser(u._id)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={safePage}
        totalItems={filteredUsers.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
        itemLabel="users"
      />

      {/* Quick Create & Assign Company Modal */}
      {companyModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Create &amp; Assign Company
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  For {companyModalUser.name || "User"} ({companyModalUser.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompanyModalUser(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70"
                aria-label="Close modal"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitQuickCompany} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickCompanyForm.name}
                  onChange={(e) =>
                    setQuickCompanyForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g. Rohan Electronics Pvt Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    Industry (Optional)
                  </label>
                  <input
                    type="text"
                    value={quickCompanyForm.industry}
                    onChange={(e) =>
                      setQuickCompanyForm((prev) => ({
                        ...prev,
                        industry: e.target.value,
                      }))
                    }
                    placeholder="e.g. Retail"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={quickCompanyForm.phone}
                    onChange={(e) =>
                      setQuickCompanyForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="e.g. +91 98765..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompanyModalUser(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCompany}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
                >
                  <FaCheck className="text-xs" />
                  {creatingCompany ? "Creating..." : "Create & Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Client Account Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Add New Client Account
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create login credentials and company workspace in one step
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddClientModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70"
                aria-label="Close modal"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitAddClient} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g. Rohan Sharma"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={clientForm.email}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="client@company.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    Password (min 6 chars) *
                  </label>
                  <div className="relative">
                    <input
                      type={showClientPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={clientForm.password}
                      onChange={(e) =>
                        setClientForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder="Set initial password"
                      className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientPassword((p) => !p)}
                      className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-500 hover:text-slate-700"
                      aria-label={
                        showClientPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showClientPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    Access Role
                  </label>
                  <select
                    value={clientForm.role}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        role: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="company_admin">Company Admin</option>
                    <option value="customer">No Access (Pending)</option>
                  </select>
                </div>
              </div>

              {clientForm.role === "company_admin" && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() =>
                        setClientForm((prev) => ({
                          ...prev,
                          companyMode: "new",
                          company_id: "",
                        }))
                      }
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                        clientForm.companyMode === "new"
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Create New Company
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setClientForm((prev) => ({
                          ...prev,
                          companyMode: "existing",
                          newCompanyName: "",
                        }))
                      }
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                        clientForm.companyMode === "existing"
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Select Existing Company
                    </button>
                  </div>

                  {clientForm.companyMode === "new" ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                          New Company Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={clientForm.newCompanyName}
                          onChange={(e) =>
                            setClientForm((prev) => ({
                              ...prev,
                              newCompanyName: e.target.value,
                            }))
                          }
                          placeholder="e.g. Rohan Electronics Pvt Ltd"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                            Industry (Optional)
                          </label>
                          <input
                            type="text"
                            value={clientForm.companyIndustry}
                            onChange={(e) =>
                              setClientForm((prev) => ({
                                ...prev,
                                companyIndustry: e.target.value,
                              }))
                            }
                            placeholder="e.g. Retail"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                            Phone (Optional)
                          </label>
                          <input
                            type="text"
                            value={clientForm.companyPhone}
                            onChange={(e) =>
                              setClientForm((prev) => ({
                                ...prev,
                                companyPhone: e.target.value,
                              }))
                            }
                            placeholder="e.g. +91 98765..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                        Existing Company *
                      </label>
                      <select
                        required
                        value={clientForm.company_id}
                        onChange={(e) =>
                          setClientForm((prev) => ({
                            ...prev,
                            company_id: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Company</option>
                        {companies.map((c) => (
                          <option key={c._id} value={c._id}>
                            {formatCompanyOption(c)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingClient}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
                >
                  <FaUserPlus className="text-xs" />
                  {creatingClient ? "Creating..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const SummaryCard = ({ title, value, icon: Icon }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-xs uppercase font-medium text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
    <span className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
      <Icon />
    </span>
  </div>
);
