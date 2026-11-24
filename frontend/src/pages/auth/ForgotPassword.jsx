import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });

      const msg =
        res.data?.message ||
        "If this email is registered, password reset instructions have been sent.";
      setSuccess(msg);
      toast.success(msg);
      setEmail("");
    } catch (err) {
      console.error("Forgot password error:", err);
      const msg =
        err.response?.data?.message || "Failed to send reset instructions.";
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
          <h2 className="text-2xl font-bold text-gray-900">Forgot Password</h2>
          <p className="text-sm text-gray-500 mt-1">
            JTS Signage — Digital Signage Platform
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="forgot-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Registered Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setError("");
                setSuccess("");
                setEmail(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg transition"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
