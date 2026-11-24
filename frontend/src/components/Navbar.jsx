import React, { useContext, useState } from "react";
import {
  FaBroadcastTower,
  FaBuilding,
  FaChartBar,
  FaFilm,
  FaListOl,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaTv,
  FaUsers,
} from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../contextAuth/AuthContext";
import ActionIconButton from "./ActionIconButton";

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/login");
  };

  const isVmsManager =
    user?.role === "admin" || user?.role === "company_admin";

  const homePath = isVmsManager
    ? "/admin"
    : user?.role === "agent"
      ? "/agent"
      : user?.role === "customer"
        ? "/customer"
        : "/";

  const navLinkClass = (pathPrefix) => {
    const isActive =
      pathPrefix === "/"
        ? location.pathname === "/"
        : location.pathname === pathPrefix ||
          location.pathname.startsWith(`${pathPrefix}/`);

    return isActive
      ? "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-xs whitespace-nowrap transition"
      : "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 font-medium text-xs whitespace-nowrap transition";
  };

  const roleLabel =
    user?.role === "admin"
      ? "Super Admin"
      : user?.role === "company_admin"
        ? "Company Admin"
        : "Pending Access";

  return (
    <nav className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="w-full px-4 sm:px-6">
        <div className="flex justify-between items-center h-14 gap-2">
          {/* Brand Logo */}
          <Link
            to={homePath}
            className="flex items-center gap-2 text-slate-900 hover:text-blue-600 transition shrink-0 whitespace-nowrap"
          >
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <FaTv className="text-sm" />
            </span>
            <div className="leading-tight">
              <span className="block text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap leading-none">
                JTS Signage
              </span>
              <span className="hidden sm:block text-[10px] text-slate-500 whitespace-nowrap mt-0.5 leading-none">
                Screen Control
              </span>
            </div>
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* Menu */}
          <div
            className={`${
              menuOpen ? "block" : "hidden"
            } lg:flex lg:items-center lg:gap-1.5 absolute lg:static top-14 left-0 w-full lg:w-auto bg-white lg:bg-transparent border-t lg:border-0 shadow-md lg:shadow-none`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center p-3 lg:p-0 gap-1">
              {/* Public */}
              {!user && (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/login")}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/register")}
                  >
                    Register
                  </Link>
                </>
              )}

              {/* VMS Manager Links */}
              {isVmsManager && (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/admin")}
                  >
                    <FaChartBar className="text-xs" /> Dashboard
                  </Link>
                  <Link
                    to="/companies"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/companies")}
                  >
                    <FaBuilding className="text-xs" /> Companies
                  </Link>
                  <Link
                    to="/locations"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/locations")}
                  >
                    <FaMapMarkerAlt className="text-xs" /> Locations
                  </Link>
                  <Link
                    to="/devices"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/devices")}
                  >
                    <FaTv className="text-xs" /> Devices
                  </Link>
                  <Link
                    to="/advertisements"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/advertisements")}
                  >
                    <FaFilm className="text-xs" /> Ads
                  </Link>
                  <Link
                    to="/playlist-builder"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/playlist-builder")}
                  >
                    <FaListOl className="text-xs" /> Playlist
                  </Link>
                  <Link
                    to="/live-screens"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/live-screens")}
                  >
                    <FaBroadcastTower className="text-xs" /> Live
                  </Link>
                  <Link
                    to="/analytics"
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClass("/analytics")}
                  >
                    <FaChartBar className="text-xs" /> Analytics
                  </Link>
                  {user?.role === "admin" && (
                    <Link
                      to="/users"
                      onClick={() => setMenuOpen(false)}
                      className={navLinkClass("/users")}
                    >
                      <FaUsers className="text-xs" /> Users
                    </Link>
                  )}
                </>
              )}

              {user?.role === "customer" && (
                <Link
                  to="/customer"
                  onClick={() => setMenuOpen(false)}
                  className={navLinkClass("/customer")}
                >
                  Customer Account
                </Link>
              )}

              {user?.role === "agent" && (
                <Link
                  to="/agent"
                  onClick={() => setMenuOpen(false)}
                  className={navLinkClass("/agent")}
                >
                  Agent Account
                </Link>
              )}

              {/* User Pill + Icon-Only Logout */}
              {user && (
                <div className="flex items-center justify-between lg:justify-start gap-2 lg:ml-1.5 lg:pl-2.5 lg:border-l border-slate-200 pt-2 lg:pt-0 shrink-0 whitespace-nowrap">
                  <span
                    title={user.name ? `${user.name} (${roleLabel})` : roleLabel}
                    className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 capitalize whitespace-nowrap"
                  >
                    {roleLabel}
                  </span>
                  <ActionIconButton
                    icon={FaSignOutAlt}
                    title="Logout"
                    variant="red"
                    size="sm"
                    onClick={handleLogout}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
