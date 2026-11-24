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

export default function Login() {
  const { token, user, saveToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token && user?.role) {
      navigate(getDashboardByRole(user.role), { replace: true });
    }
  }, [token, user, navigate]);

  const handleChange = (e) => {
    setError("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", {
        email: form.email.trim(),
        password: form.password,
      });

      saveToken(res.data.token, res.data.user);
      toast.success("Welcome back!");
      navigate(getDashboardByRole(res.data.user?.role), { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid email or password";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="text-center mb-5">
          <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
          <p className="text-sm text-gray-500 mt-1">
            JTS Signage — Digital Signage Platform
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="flex justify-end text-sm">
            <Link
              to="/forgot-password"
              className="text-blue-600 hover:underline font-medium"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg transition"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="text-blue-600 hover:underline font-medium"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
