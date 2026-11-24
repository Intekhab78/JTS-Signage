import React, { useContext, useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { AuthContext } from "../../contextAuth/AuthContext";
import { useToast } from "../../context/ToastContext";

const getDashboardByRole = (role) => {
  if (role === "admin" || role === "company_admin") return "/admin";
  if (role === "agent") return "/agent";
  if (role === "customer") return "/customer";
  return "/";
};

export default function Register() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    email: "",
    companyName: "",
    password: "",
    confirmPassword: "",
  });
  const [hasAdmin, setHasAdmin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (token && user?.role) {
      navigate(getDashboardByRole(user.role), { replace: true });
    }
  }, [token, user, navigate]);

  useEffect(() => {
    api
      .get("/auth/setup-status")
      .then((res) => {
        if (typeof res.data?.hasAdmin === "boolean") {
          setHasAdmin(res.data.hasAdmin);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    setError("");
    setSuccess("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Full name is required");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        name: form.name.trim(),
        email: form.email.trim(),
        companyName: form.companyName.trim(),
        password: form.password,
      });

      const msg =
        res.data?.message || "Account created successfully! Please sign in.";
      setSuccess(msg);
      toast.success(msg);
      navigate("/login");
    } catch (err) {
      const msg = err.response?.data?.message || "Registration failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
          <p className="text-sm text-gray-500 mt-1">
            JTS Signage — Digital Signage Platform
          </p>
        </div>

        {hasAdmin === false && (
          <div className="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs">
            Initial setup: This first account will automatically be created as
            Super Admin.
          </div>
        )}

        {error && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 p-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="reg-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Full Name
              </label>
              <input
                id="reg-name"
                name="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter full name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="reg-email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {hasAdmin !== false && (
            <div>
              <label
                htmlFor="reg-company"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Company / Business Name
              </label>
              <input
                id="reg-company"
                name="companyName"
                type="text"
                autoComplete="organization"
                value={form.companyName}
                onChange={handleChange}
                placeholder="e.g. Rohan Electronics Pvt Ltd"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Helps the Super Admin create &amp; approve your company workspace
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="reg-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password (min. 6 chars)
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Create password"
                  required
                  className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-2.5 flex items-center text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="reg-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-2.5 flex items-center text-gray-500 hover:text-gray-700"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg transition mt-1"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
