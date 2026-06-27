const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {
      // response had no JSON body - keep the generic message
    }
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  products: {
    list: () => request("/products/"),
    get: (id) => request(`/products/${id}`),
    create: (data) => request("/products/", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) =>
      request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id) => request(`/products/${id}`, { method: "DELETE" }),
  },
  customers: {
    list: () => request("/customers/"),
    get: (id) => request(`/customers/${id}`),
    create: (data) => request("/customers/", { method: "POST", body: JSON.stringify(data) }),
    remove: (id) => request(`/customers/${id}`, { method: "DELETE" }),
  },
  orders: {
    list: () => request("/orders/"),
    get: (id) => request(`/orders/${id}`),
    create: (data) => request("/orders/", { method: "POST", body: JSON.stringify(data) }),
    remove: (id) => request(`/orders/${id}`, { method: "DELETE" }),
  },
  dashboard: {
    get: () => request("/dashboard/"),
  },
};
