import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";

const LOW_STOCK_THRESHOLD = 10;
const EMPTY_FORM = { name: "", sku: "", price: "", stock_quantity: "" };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = create, {...} = edit
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    api.products
      .list()
      .then(setProducts)
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditing({});
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      sku: product.sku,
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
    });
    setFormErrors({});
    setEditing(product);
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Product name is required";
    if (!form.sku.trim()) errors.sku = "SKU is required";
    if (form.price === "" || Number(form.price) < 0)
      errors.price = "Price must be a non-negative number";
    if (form.stock_quantity === "" || Number(form.stock_quantity) < 0 || !Number.isInteger(Number(form.stock_quantity)))
      errors.stock_quantity = "Stock must be a non-negative whole number";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      stock_quantity: Number(form.stock_quantity),
    };

    setSubmitting(true);
    try {
      if (editing?.id) {
        await api.products.update(editing.id, payload);
        showToast(`"${payload.name}" updated`, "success");
      } else {
        await api.products.create(payload);
        showToast(`"${payload.name}" added`, "success");
      }
      setEditing(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.products.remove(deleting.id);
      showToast(`"${deleting.name}" deleted`, "success");
      setDeleting(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div>
      <div className="page-header page-header--row">
        <div>
          <h1>Products</h1>
          <p className="page-subtitle">Manage your catalog and stock levels.</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          + Add Product
        </button>
      </div>

      <section className="panel">
        {loading ? (
          <p className="page-loading">Loading products…</p>
        ) : products.length === 0 ? (
          <EmptyState title="No products yet" hint="Add your first product to get started." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Stock</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className={p.stock_quantity < LOW_STOCK_THRESHOLD ? "table__row--warning" : ""}
                >
                  <td>{p.name}</td>
                  <td>
                    <span className="badge badge--mono">{p.sku}</span>
                  </td>
                  <td>${p.price.toFixed(2)}</td>
                  <td>
                    {p.stock_quantity < LOW_STOCK_THRESHOLD ? (
                      <span className="badge badge--warning">{p.stock_quantity} low</span>
                    ) : (
                      p.stock_quantity
                    )}
                  </td>
                  <td className="table__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button
                      className="btn btn--ghost btn--sm btn--danger-text"
                      onClick={() => setDeleting(p)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing !== null && (
        <Modal title={editing.id ? "Edit Product" : "Add Product"} onClose={() => setEditing(null)}>
          <form onSubmit={handleSubmit} className="form">
            <div className="form-field">
              <label htmlFor="name">Product name</label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
              {formErrors.name && <span className="form-error">{formErrors.name}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="sku">SKU / code</label>
              <input
                id="sku"
                className="input--mono"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
              {formErrors.sku && <span className="form-error">{formErrors.sku}</span>}
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="price">Price ($)</label>
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                {formErrors.price && <span className="form-error">{formErrors.price}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="stock">Stock quantity</label>
                <input
                  id="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                />
                {formErrors.stock_quantity && (
                  <span className="form-error">{formErrors.stock_quantity}</span>
                )}
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? "Saving…" : editing.id ? "Save changes" : "Add product"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete product"
          message={`Are you sure you want to delete "${deleting.name}"? This can't be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
