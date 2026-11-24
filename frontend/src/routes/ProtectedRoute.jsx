import React, { useContext } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthContext } from "../contextAuth/AuthContext";

export default function ProtectedRoute({ children, role, roles }) {
  const { token, user } = useContext(AuthContext);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = roles || (role ? [role] : null);

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border rounded-xl shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 text-sm mb-6">
            You do not have permission to view this page.
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
