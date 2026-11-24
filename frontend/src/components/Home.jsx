import React, { useContext } from "react";
import {
  FaBroadcastTower,
  FaBuilding,
  FaChartBar,
  FaClock,
  FaFilm,
  FaQrcode,
  FaTv,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { AuthContext } from "../contextAuth/AuthContext";

export default function Home() {
  const { user } = useContext(AuthContext);

  const isVmsManager =
    user?.role === "admin" || user?.role === "company_admin";

  const dashboardPath = isVmsManager
    ? "/admin"
    : user?.role === "agent"
      ? "/agent"
      : "/customer";

  const features = [
    {
      title: "Multi-Location TV Control",
      desc: "Organize companies, branches, and individual Smart TV screens with isolated tenant permissions.",
      icon: FaTv,
      color: "bg-blue-50 text-blue-600 border-blue-200",
    },
    {
      title: "Real-Time Play, Pause & Stop",
      desc: "Push video or image playlists instantly to a single TV or broadcast to an entire location over Socket.IO.",
      icon: FaBroadcastTower,
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    {
      title: "Automated Scheduling & Offline Cache",
      desc: "Schedule campaigns by dates, weekdays, and time slots with priority fallback and offline PWA playback.",
      icon: FaClock,
      color: "bg-purple-50 text-purple-600 border-purple-200",
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Setup Hierarchy",
      desc: "Create Companies and Branch Locations.",
      icon: FaBuilding,
    },
    {
      step: "02",
      title: "Pair TV Screen",
      desc: "Open /pair on Smart TV and enter 6-digit code.",
      icon: FaQrcode,
    },
    {
      step: "03",
      title: "Upload & Order Ads",
      desc: "Upload Videos/Images, set Tickers & Drag-Drop order.",
      icon: FaFilm,
    },
    {
      step: "04",
      title: "Monitor & Analyze",
      desc: "Track live streams, device health & Proof-of-Play CSV.",
      icon: FaChartBar,
    },
  ];

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-800">
      {/* HERO */}
      <section className="w-full px-4 sm:px-6 pt-16 pb-12 text-center">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-5 text-xs font-semibold tracking-wide uppercase bg-blue-100 text-blue-700 rounded-full border border-blue-200">
          <FaBroadcastTower /> Smart Digital Signage Platform
        </span>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
          Video Advertisement &amp;{" "}
          <span className="text-blue-600">Screen Management</span>
        </h1>

        <p className="text-slate-600 max-w-2xl mx-auto text-base sm:text-lg mb-8">
          Manage companies, branch locations, Smart TV displays, and scheduled
          video or image campaigns with live monitoring and Proof-of-Play
          analytics.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {user ? (
            <>
              <Link
                to={dashboardPath}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition"
              >
                Go to Dashboard
              </Link>
              {isVmsManager && (
                <Link
                  to="/live-screens"
                  className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold rounded-xl shadow-sm transition"
                >
                  Open Live Screens
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition"
              >
                Sign In
              </Link>
              <Link
                to="/pair"
                className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold rounded-xl shadow-sm transition"
              >
                Pair a TV Screen
              </Link>
            </>
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section className="w-full px-4 sm:px-6 pb-12 grid md:grid-cols-3 gap-6">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition border border-slate-200/80 flex flex-col items-start"
            >
              <span
                className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg mb-4 ${item.color}`}
              >
                <Icon />
              </span>
              <h3 className="font-bold text-lg text-slate-900 mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {item.desc}
              </p>
            </div>
          );
        })}
      </section>

      {/* 4-STEP WORKFLOW */}
      <section className="w-full px-4 sm:px-6 pb-14">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            How the Platform Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/70"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-600">
                      STEP {s.step}
                    </span>
                    <Icon className="text-slate-400" />
                  </div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    {s.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
