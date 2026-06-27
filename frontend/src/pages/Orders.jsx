import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";

const emptyLine = () => ({ product_id: "", quantity: "1" });

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const { showToast } = useToast();

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([emptyLine()]);

  const customerById = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c])),
    [customers]
  );
  const productById = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  );

  const load = () => {
    setLoading(true);
    Promise.all([api.orders.list(), api.customers.list(), api.products.list()])
      .then(([o, c, p]) => {
        setOrders(o);
        setCustomers(c);
        setProducts(p);
      })
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setCustomerId("");
    setLines([emptyLine()]);
    setFormError("");
    setCreating(true);
  };

  const updateLine = (index, field, value) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index) => setLines((prev) => prev.filter((_, i) => i !== index));

  const liveTotal = lines.reduce((sum, line) => {
    const product = productById[Number(line.product_id)];
    const qty = Number(line.quantity) || 0;
    return product ? sum + product.price * qty : sum;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!customerId) {
      setFormError("Select a customer for this order.");
      return;
    }
    const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      setFormError("Add at least one product with a quantity greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      await api.orders.create({
        customer_id: Number(customerId),
        items: validLines.map((l) => ({
          product_id: Number(l.product_id),
          quantity: Number(l.quantity),
        })),
      });
      showToast("Order created", "success");
      setCreating(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await api.orders.remove(cancelling.id);
      showToast(`Order #${cancelling.id} cancelled`, "success");
      setCancelling(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div>
      <div className="page-header page-header--row">
        <div>
          <h1>Orders</h1>
          <p className="page-subtitle">Create orders and track fulfillment.</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate} disabled={products.length === 0}>
          + Create Order
        </button>
      </div>

      <section className="panel">
        {loading ? (
          <p className="page-loading">Loading orders…</p>
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet" hint="Create your first order to see it here." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="badge badge--mono">#{o.id}</span>
                  </td>
                  <td>{customerById[o.customer_id]?.name || `Customer #${o.customer_id}`}</td>
                  <td>{o.items.length}</td>
                  <td>${o.total_amount.toFixed(2)}</td>
                  <td>
                    <span className="badge badge--success">{o.status}</span>
                  </td>
                  <td className="table__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => setViewing(o)}>
                      View
                    </button>
                    <button
                      className="btn btn--ghost btn--sm btn--danger-text"
                      onClick={() => setCancelling(o)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {creating && (
        <Modal title="Create Order" onClose={() => setCreating(false)} width={560}>
          <form onSubmit={handleSubmit} className="form">
            <div className="form-field">
              <label htmlFor="customer">Customer</label>
              <select
                id="customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Items</label>
              {lines.map((line, i) => {
                const product = productById[Number(line.product_id)];
                return (
                  <div className="order-line" key={i}>
                    <select
                      value={line.product_id}
                      onChange={(e) => updateLine(i, "product_id", e.target.value)}
                    >
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ${p.price.toFixed(2)} ({p.stock_quantity} in stock)
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="order-line__qty"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    />
                    <span className="order-line__subtotal">
                      {product ? `$${(product.price * (Number(line.quantity) || 0)).toFixed(2)}` : "—"}
                    </span>
                    <button
                      type="button"
                      className="order-line__remove"
                      onClick={() => removeLine(i)}
                      disabled={lines.length === 1}
                      aria-label="Remove item"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button type="button" className="btn btn--ghost btn--sm" onClick={addLine}>
                + Add another item
              </button>
            </div>

            <div className="order-total">
              <span>Order total</span>
              <strong>${liveTotal.toFixed(2)}</strong>
            </div>

            {formError && <p className="form-error form-error--banner">{formError}</p>}

            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? "Placing order…" : "Place order"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Order #${viewing.id}`} onClose={() => setViewing(null)} width={480}>
          <div className="order-detail">
            <div className="order-detail__row">
              <span>Customer</span>
              <strong>{customerById[viewing.customer_id]?.name || `#${viewing.customer_id}`}</strong>
            </div>
            <div className="order-detail__row">
              <span>Status</span>
              <span className="badge badge--success">{viewing.status}</span>
            </div>
            <div className="order-detail__row">
              <span>Placed</span>
              <span>{new Date(viewing.created_at).toLocaleString()}</span>
            </div>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((item) => (
                  <tr key={item.id}>
                    <td>{productById[item.product_id]?.name || `Product #${item.product_id}`}</td>
                    <td>{item.quantity}</td>
                    <td>${item.unit_price.toFixed(2)}</td>
                    <td>${(item.unit_price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="order-total">
              <span>Total</span>
              <strong>${viewing.total_amount.toFixed(2)}</strong>
            </div>
          </div>
        </Modal>
      )}

      {cancelling && (
        <ConfirmDialog
          title="Cancel order"
          message={`Cancel order #${cancelling.id}? Reserved stock will be returned to inventory.`}
          confirmLabel="Cancel order"
          onConfirm={handleCancel}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
