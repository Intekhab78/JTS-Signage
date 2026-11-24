import React from "react";
import { Link } from "react-router-dom";

const VARIANTS = {
  blue: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600",
  green:
    "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600",
  amber:
    "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-500 hover:text-white hover:border-amber-500",
  red: "bg-red-50 text-red-600 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600",
  purple:
    "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white hover:border-purple-600",
  indigo:
    "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600",
  slate:
    "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-700",
};

const SIZES = {
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-10 h-10 text-base",
};

export default function ActionIconButton({
  icon: Icon,
  title,
  variant = "slate",
  size = "sm",
  to,
  href,
  target,
  rel,
  onClick,
  disabled = false,
  type = "button",
  className = "",
}) {
  const baseClass = `inline-flex items-center justify-center rounded-lg border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${
    VARIANTS[variant] || VARIANTS.slate
  } ${SIZES[size] || SIZES.sm} ${className}`;

  if (to) {
    return (
      <Link to={to} title={title} aria-label={title} className={baseClass}>
        <Icon />
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel || (target === "_blank" ? "noreferrer" : undefined)}
        title={title}
        aria-label={title}
        className={baseClass}
      >
        <Icon />
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={baseClass}
    >
      <Icon />
    </button>
  );
}
