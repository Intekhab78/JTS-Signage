import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../contextAuth/AuthContext";

export default function Footer() {
  const { user } = useContext(AuthContext);

  const isVmsManager =
    user?.role === "admin" || user?.role === "company_admin";

  const links = !user
    ? [
        { to: "/", label: "Home" },
        { to: "/pair", label: "Pair TV" },
        { to: "/login", label: "Sign In" },
        { to: "/register", label: "Register" },
      ]
    : isVmsManager
      ? [
          { to: "/admin", label: "Dashboard" },
          { to: "/devices", label: "Devices" },
          { to: "/live-screens", label: "Live Screens" },
          { to: "/analytics", label: "Analytics" },
          { to: "/pair", label: "Pair TV" },
        ]
      : [
          { to: "/", label: "Home" },
          {
            to: user.role === "agent" ? "/agent" : "/customer",
            label: "My Account",
          },
        ];

  return (
    <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-gray-400 mt-auto border-t border-gray-700">
      <div className="w-full px-4 sm:px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Brand Identity */}
        <div className="text-center md:text-left">
          <h3 className="text-white font-semibold text-lg tracking-wide">
            JTS Signage
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Smart Digital Signage &amp; Ad Control Platform
          </p>
        </div>

        {/* Role-Aware Navigation Links */}
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap justify-center gap-6 text-sm"
        >
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="hover:text-white transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700/80">
        <div className="w-full px-4 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-500">
          <span>
            &copy; {new Date().getFullYear()} JTS MIDDLEEAST. All rights
            reserved.
          </span>
          <span className="text-gray-400">
            Digital Signage &amp; Screen Control Suite
          </span>
        </div>
      </div>
    </footer>
  );
}
