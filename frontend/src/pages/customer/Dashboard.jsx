import React, { useContext } from "react";
import { FaArrowLeft, FaUserShield } from "react-icons/fa";
import ActionIconButton from "../../components/ActionIconButton";
import { AuthContext } from "../../contextAuth/AuthContext";

export default function CustomerDashboard() {
  const { user } = useContext(AuthContext);

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center text-lg">
              <FaUserShield />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Account Pending Company Access
              </h1>
              <p className="text-sm text-slate-500">
                Signed in to JTS Signage
              </p>
            </div>
          </div>

          <ActionIconButton
            icon={FaArrowLeft}
            title="Back to Home"
            variant="slate"
            size="md"
            to="/"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <p className="text-xs uppercase text-slate-500 font-medium">Name</p>
            <p className="font-semibold text-slate-900 mt-1">
              {user?.name || "—"}
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <p className="text-xs uppercase text-slate-500 font-medium">Role</p>
            <p className="font-semibold text-slate-900 mt-1 capitalize">
              {user?.role || "customer"}
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <p className="text-xs uppercase text-slate-500 font-medium">
              Status
            </p>
            <p className="font-semibold mt-1 text-emerald-700">Active</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          Video Advertisement management controls (companies, locations,
          devices, and live screens) require an administrator or company admin
          account. Contact a Super Admin if you need management access.
        </div>
      </div>
    </div>
  );
}
