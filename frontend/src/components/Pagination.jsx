import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const buildPageItems = (safePage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set([
    1,
    totalPages,
    Math.max(1, safePage - 1),
    safePage,
    Math.min(totalPages, safePage + 1),
  ]);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push(`ellipsis-${sorted[i - 1]}-${sorted[i]}`);
    }
    result.push(sorted[i]);
  }
  return result;
};

export default function Pagination({
  page = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  itemLabel = "items",
  className = "",
}) {
  if (!totalItems || totalItems <= 0) return null;

  const perPage = Math.max(1, Number(itemsPerPage) || 10);
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIndex = (safePage - 1) * perPage + 1;
  const endIndex = Math.min(safePage * perPage, totalItems);
  const pageItems = totalPages > 1 ? buildPageItems(safePage, totalPages) : [];

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 ${className}`.trim()}
    >
      <span>
        Showing {startIndex}–{endIndex} of {totalItems} {itemLabel}
      </span>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-100 disabled:opacity-45 disabled:pointer-events-none transition"
          >
            <FaChevronLeft className="text-[10px]" />
            <span>Prev</span>
          </button>

          {pageItems.map((item) =>
            typeof item === "string" ? (
              <span key={item} className="px-1.5 text-slate-400 select-none">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`min-w-[30px] px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                  safePage === item
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-100 disabled:opacity-45 disabled:pointer-events-none transition"
          >
            <span>Next</span>
            <FaChevronRight className="text-[10px]" />
          </button>
        </div>
      )}
    </div>
  );
}
