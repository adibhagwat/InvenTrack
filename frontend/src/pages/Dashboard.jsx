import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useToast } from "../components/Toast.jsx";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    api.dashboard
      .get()
      .then((data) => active && setStats(data))
      .catch((err) => active && showToast(err.message, "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [showToast]);

  if (loading) return <p className="page-loading">Loading dashboard…</p>;
  if (!stats) return <EmptyState title="Couldn't load dashboard data" />;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-subtitle">A snapshot of your inventory and sales activity.</p>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Products" value={stats.total_products} />
        <StatCard label="Total Customers" value={stats.total_customers} />
        <StatCard label="Total Orders" value={stats.total_orders} />
        <StatCard
          label="Low Stock Items"
          value={stats.low_stock_products.length}
          accent={stats.low_stock_products.length > 0 ? "warning" : "default"}
        />
      </div>

      <section className="panel">
        <div className="panel__header">
          <h2>Low stock products</h2>
          <span className="panel__hint">Below 10 units remaining</span>
        </div>

        {stats.low_stock_products.length === 0 ? (
          <EmptyState
            title="Nothing running low"
            hint="All products currently have healthy stock levels."
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {stats.low_stock_products.map((p) => (
                <tr key={p.id} className="table__row--warning">
                  <td>{p.name}</td>
                  <td>
                    <span className="badge badge--mono">{p.sku}</span>
                  </td>
                  <td>
                    <span className="badge badge--warning">{p.stock_quantity} left</span>
                  </td>
                  <td>${p.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
