import { useCallback, useEffect, useMemo, useState } from "react";
import "./Customers.css";
import { API_BASE, apiFetch, requireRestaurantId, shortOrderId, useActiveRestaurantId } from "./restaurantApi";

function listFrom(data) {
  if (Array.isArray(data)) return data;
  return data?.customers || data?.content || data?.data || [];
}
function value(obj, keys, fallback = "—") {
  for (const key of keys) {
    const v = obj?.[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}
function currency(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}
function date(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function initials(name) {
  return String(name || "Customer").trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() || "").join("") || "C";
}
function customerName(c) {
  return value(c, ["fullName", "customerName", "name"], "Customer");
}
function customerMobile(c) {
  return value(c, ["mobileNumber", "phone", "phoneNumber", "mobile"]);
}
function customerEmail(c) {
  return value(c, ["email", "emailAddress"]);
}
function customerId(c) {
  return value(c, ["id", "customerId"], "");
}

function httpError(status, resource) {
  switch (status) {
    case 401: return `${resource}: Authentication required. Please sign in again.`;
    case 403: return `${resource}: Access denied for the selected restaurant.`;
    case 404: return `${resource}: Customer endpoint or requested customer was not found (HTTP 404).`;
    case 500: return `${resource}: The backend encountered an internal error (HTTP 500).`;
    default: return `${resource}: Request failed with HTTP ${status}.`;
  }
}

export default function Customers() {
  const restaurantId = useActiveRestaurantId();
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    setCustomers([]);
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/customers`, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(httpError(response.status, "Could not load customers"));
      const data = await response.json();
      setCustomers(listFrom(data));
    } catch (e) {
      setError(e.message || "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // The effect starts the async request when the active restaurant changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(c =>
      [customerName(c), customerMobile(c), customerEmail(c)].some(v => String(v).toLowerCase().includes(term))
    );
  }, [customers, query]);

  const totalSpend = customers.reduce((sum, c) => {
    const amount = Number(value(c, ["totalSpent", "totalSpending", "totalAmountSpent"], 0));
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  async function openCustomer(customer) {
    setSelected(customer);
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    const id = customerId(customer);
    if (!id) {
      setDetailsError("Customer ID is missing in the customer list response.");
      setDetailsLoading(false);
      return;
    }
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/customers/${id}`, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(httpError(response.status, "Could not load customer details"));
      setDetails(await response.json());
    } catch (e) {
      setDetailsError(e.message || "Could not load customer details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  const detailCustomer = details?.customer || details?.data || details || selected;
  const orderHistory = details?.orders || details?.orderHistory || detailCustomer?.orders || detailCustomer?.orderHistory || [];

  return (
    <div className="cu-page">
      <section className="cu-heading">
        <div>
          <p className="cu-eyebrow">CUSTOMER RELATIONSHIPS</p>
          <h1>Customers</h1>
          <p className="cu-subtitle">View customers who have placed orders at your restaurant.</p>
        </div>
        <button className="cu-refresh" type="button" onClick={loadCustomers}>↻ <span>Refresh</span></button>
      </section>

      {error && <div className="cu-alert" role="alert">{error}</div>}

      <section className="cu-stats">
        <article className="cu-stat">
          <span className="cu-stat-icon">♙</span>
          <span className="cu-stat-label">Total customers</span>
          <strong>{loading ? "…" : customers.length}</strong>
          <small>Customers with orders at this restaurant</small>
        </article>
        <article className="cu-stat">
          <span className="cu-stat-icon">₹</span>
          <span className="cu-stat-label">Total customer spending</span>
          <strong>{loading ? "…" : currency(totalSpend)}</strong>
          <small>Paid, non-cancelled customer orders</small>
        </article>
        <article className="cu-stat">
          <span className="cu-stat-icon">✓</span>
          <span className="cu-stat-label">Mobile verified</span>
          <strong>{loading ? "…" : customers.filter(c => c.mobileVerified === true).length}</strong>
          <small>Only when the backend marks mobileVerified true</small>
        </article>
      </section>

      <section className="cu-panel">
        <div className="cu-panel-head">
          <div><h2>Customer directory</h2><p>{filtered.length} customer{filtered.length === 1 ? "" : "s"} found</p></div>
          <label className="cu-search">
            <span>⌕</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, mobile or email" />
          </label>
        </div>

        {loading ? <div className="cu-state">Loading customers…</div> :
          filtered.length === 0 ? <div className="cu-state">{query ? "No customers match your search." : "No customers found yet. Customers will appear here after placing an order with their details."}</div> :
          <div className="cu-table-wrap">
            <table className="cu-table">
              <thead><tr><th>CUSTOMER</th><th>MOBILE</th><th>EMAIL</th><th>ORDERS</th><th>TOTAL SPENT</th><th>JOINED</th><th></th></tr></thead>
              <tbody>
                {filtered.map((c, index) => (
                  <tr key={customerId(c) || index}>
                    <td><div className="cu-person"><span className="cu-avatar">{initials(customerName(c))}</span><strong>{customerName(c)}</strong></div></td>
                    <td>{customerMobile(c)}</td>
                    <td>{customerEmail(c)}</td>
                    <td>{value(c, ["totalOrders", "orderCount", "ordersCount"])}</td>
                    <td className="cu-spend">{currency(value(c, ["totalSpent", "totalSpending", "totalAmountSpent"], NaN))}</td>
                    <td>{date(value(c, ["createdAt", "registeredAt", "registrationDate"], null))}</td>
                    <td><button className="cu-view" type="button" onClick={() => openCustomer(c)}>View details →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </section>

      {selected && (
        <div className="cu-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <section className="cu-modal" role="dialog" aria-modal="true" aria-label="Customer details">
            <div className="cu-modal-head">
              <div><p className="cu-eyebrow">CUSTOMER PROFILE</p><h2>{customerName(detailCustomer)}</h2></div>
              <button type="button" className="cu-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>
            {detailsLoading ? <div className="cu-state">Loading customer details…</div> : detailsError ? <div className="cu-alert">{detailsError}</div> : (
              <>
                <div className="cu-profile-grid">
                  <div><small>Mobile</small><strong>{customerMobile(detailCustomer)}</strong></div>
                  <div><small>Email</small><strong>{customerEmail(detailCustomer)}</strong></div>
                  <div><small>Registered</small><strong>{date(value(detailCustomer, ["createdAt", "registeredAt"], null))}</strong></div>
                  <div><small>Mobile verification</small><strong>{detailCustomer?.mobileVerified === true ? "Verified" : "Not verified"}</strong></div>
                  <div><small>Total orders</small><strong>{value(detailCustomer, ["totalOrders", "orderCount"], orderHistory.length)}</strong></div>
                  <div><small>Total spending</small><strong>{currency(value(detailCustomer, ["totalSpent", "totalSpending"], 0))}</strong></div>
                </div>
                <div className="cu-history-head"><h3>Order history</h3><span>{orderHistory.length} orders</span></div>
                {orderHistory.length === 0 ? <div className="cu-state">No order history was included in this customer details response.</div> :
                  <div className="cu-history">
                    {orderHistory.map((order, i) => (
                      <div className="cu-history-row" key={order.id || order.orderNumber || i}>
                        <div><strong>{shortOrderId(order.orderNumber, order.id)}</strong><small>{date(order.createdAt)}</small></div>
                        <span className="cu-order-status">{String(order.orderStatus || order.status || "—").replaceAll("_", " ")}</span>
                        <strong>{currency(order.bill?.totalAmount ?? order.totalAmount)}</strong>
                      </div>
                    ))}
                  </div>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
