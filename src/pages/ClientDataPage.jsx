import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "./restaurantApi";
import "./ClientDataPage.css";

const TOKEN_KEY = "texos-admin-token";
const isoDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));

export default function ClientDataPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [range, setRange] = useState("today");
  const [fromDate, setFromDate] = useState(isoDate(today));
  const [toDate, setToDate] = useState(isoDate(today));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dates = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    if (range === "last7") start.setDate(start.getDate() - 6);
    if (range === "lastMonth") {
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      end.setDate(0);
    }
    if (range === "custom") return { from: fromDate, to: toDate };
    return { from: isoDate(start), to: isoDate(end) };
  }, [range, fromDate, toDate]);

  const loadData = useCallback(async () => {
    if (range === "custom" && (!fromDate || !toDate || fromDate > toDate)) {
      setError("Please select a valid custom date range.");
      return;
    }
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      navigate("/texos-admin/login", { replace: true });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/admin/client-data/restaurants/${restaurantId}?from=${dates.from}&to=${dates.to}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.error || `Request failed (HTTP ${response.status})`);
      setData(result);
    } catch (err) {
      setError(err.message || "Unable to load client data.");
    } finally {
      setLoading(false);
    }
  }, [dates.from, dates.to, fromDate, navigate, range, restaurantId, toDate]);

  useEffect(() => { loadData(); }, [loadData]);

  return <main className="client-data-page">
    <header className="client-data-header">
      <button type="button" className="client-data-back" onClick={() => navigate("/texos-admin")}>← Admin dashboard</button>
      <div><p className="client-data-eyebrow">TEXOS ADMIN · CLIENT ANALYTICS</p><h1>{data?.restaurantName || "Client Data"}</h1><p>Restaurant customer and order performance</p></div>
      <button type="button" className="client-data-refresh" onClick={loadData} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</button>
    </header>

    <section className="client-data-filter">
      <label>Data period
        <select value={range} onChange={(event) => setRange(event.target.value)}>
          <option value="today">Today</option>
          <option value="last7">Last 7 days</option>
          <option value="lastMonth">Last Month</option>
          <option value="custom">Customized Date</option>
        </select>
      </label>
      {range === "custom" && <>
        <label>From date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To date<input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <button type="button" onClick={loadData} disabled={loading}>Apply</button>
      </>}
      <span>{dates.from} — {dates.to}</span>
    </section>

    {error && <div className="client-data-error" role="alert">{error}</div>}
    {loading && !data ? <p className="client-data-empty">Loading client data…</p> : data && <>
      <section className="client-data-metrics">
        <article><span>Total customers</span><strong>{data.totalCustomers ?? 0}</strong></article>
        <article><span>Total orders</span><strong>{data.totalOrders ?? 0}</strong></article>
        <article><span>Items ordered</span><strong>{data.totalItems ?? 0}</strong></article>
        <article><span>Total bill amount</span><strong>{money(data.totalBillAmount)}</strong></article>
      </section>
      <section className="client-data-table-card">
        <div><h2>Customer-wise data</h2><p>Orders, total item quantity and total bill amount per customer.</p></div>
        {data.customers?.length ? <div className="client-data-table-wrap"><table><thead><tr><th>Customer</th><th>Mobile</th><th>Orders</th><th>Items ordered</th><th>Total bill amount</th></tr></thead><tbody>
          {data.customers.map((customer, index) => <tr key={`${customer.mobileNumber || customer.customerName}-${index}`}><td>{customer.customerName}</td><td>{customer.mobileNumber || "—"}</td><td>{customer.orders}</td><td>{customer.items}</td><td>{money(customer.totalBillAmount)}</td></tr>)}
        </tbody></table></div> : <p className="client-data-empty">No customer orders found for this period.</p>}
      </section>
    </>}
  </main>;
}
