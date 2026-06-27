import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/products", label: "Products" },
  { to: "/customers", label: "Customers" },
  { to: "/orders", label: "Orders" },
];

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="topbar__menu-btn"
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          <span />
          <span />
          <span />
        </button>
        <div className="topbar__brand">
          <span className="topbar__brand-mark">IT</span>
          <span>InvenTrack</span>
        </div>
      </header>

      <nav className={`sidebar ${navOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">IT</span>
          <div>
            <strong>InvenTrack</strong>
            <small>Inventory &amp; Orders</small>
          </div>
        </div>
        <ul className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  "sidebar__link" + (isActive ? " sidebar__link--active" : "")
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {navOpen && <div className="sidebar__scrim" onClick={() => setNavOpen(false)} />}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
