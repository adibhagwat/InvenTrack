import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";

const EMPTY_FORM = { name: "", email: "", phone: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    api.customers
      .list()
      .then(setCustomers)
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setCreating(true);
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Full name is required";
    if (!EMAIL_RE.test(form.email.trim())) errors.email = "Enter a valid email address";
    if (!form.phone.trim()) errors.phone = "Phone number is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await api.customers.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      showToast(`"${form.name.trim()}" added`, "success");
      setCreating(false);
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.customers.remove(deleting.id);
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
          <h1>Customers</h1>
          <p className="page-subtitle">Everyone who can place an order.</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          + Add Customer
        </button>
      </div>

      <section className="panel">
        {loading ? (
          <p className="page-loading">Loading customers…</p>
        ) : customers.length === 0 ? (
          <EmptyState title="No customers yet" hint="Add your first customer to get started." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone || "—"}</td>
                  <td className="table__actions">
                    <button
                      className="btn btn--ghost btn--sm btn--danger-text"
                      onClick={() => setDeleting(c)}
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

      {creating && (
        <Modal title="Add Customer" onClose={() => setCreating(false)}>
          <form onSubmit={handleSubmit} className="form">
            <div className="form-field">
              <label htmlFor="cname">Full name</label>
              <input
                id="cname"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
              {formErrors.name && <span className="form-error">{formErrors.name}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="cemail">Email address</label>
              <input
                id="cemail"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {formErrors.email && <span className="form-error">{formErrors.email}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="cphone">Phone number</label>
              <input
                id="cphone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              {formErrors.phone && <span className="form-error">{formErrors.phone}</span>}
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? "Saving…" : "Add customer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete customer"
          message={`Are you sure you want to delete "${deleting.name}"? This can't be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
