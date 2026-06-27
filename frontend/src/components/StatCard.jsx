import React from "react";

export default function StatCard({ label, value, accent = "default" }) {
  return (
    <div className={`stat-card stat-card--${accent}`}>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}
