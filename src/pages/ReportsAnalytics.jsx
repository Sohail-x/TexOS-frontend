import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch, requireRestaurantId, shortOrderId, useActiveRestaurantId } from "./restaurantApi";
import "./ReportsAnalytics.css";


function getOrders(data) {
  if (Array.isArray(data)) return data;
  return data?.content || data?.orders || data?.data || [];
}
function amount(order) {
  const value = order?.bill?.totalAmount ?? order?.totalAmount ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}
function orderDate(order) {
  const date = new Date(order.createdAt || order.orderTime || order.createdOn || "");
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatDate(value) {
  if (!value) return "—";
  return value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReportsAnalytics() {
  const restaurantId = useActiveRestaurantId();
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState("7");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await apiFetch(
        `${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/dashboard/analytics?period=${encodeURIComponent(period)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) throw new Error(`Could not load report data (HTTP ${response.status}).`);
      const data = await response.json();
      setAnalytics(data);
      setOrders(getOrders(data));
    } catch (err) {
      setError(err.message || "Unable to load reports from the backend.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, restaurantId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!restaurantId) {
        setOrders([]);
        setAnalytics(null);
        setLoading(false);
        return;
      }
      loadOrders();
    });
    return () => {
      active = false;
    };
  }, [loadOrders, restaurantId]);

  const filtered = orders;

  const stats = useMemo(() => {
    if (!analytics) {
      return {
        revenue: 0,
        total: 0,
        paid: 0,
        pending: 0,
        cancelled: 0,
        average: 0,
        statusCounts: ["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"].map((status) => ({ status, count: 0 })),
        topItems: [],
      };
    }
    return {
      revenue: Number(analytics.revenue || 0),
      total: Number(analytics.total || 0),
      paid: Number(analytics.paid || 0),
      pending: Number(analytics.pending || 0),
      cancelled: Number(analytics.cancelled || 0),
      average: Number(analytics.average || 0),
      statusCounts: Array.isArray(analytics.statusCounts) ? analytics.statusCounts : [],
      topItems: Array.isArray(analytics.topItems) ? analytics.topItems : [],
    };
  }, [analytics]);

  function exportCsv() {
    const rows = [["Order Number", "Date", "Table", "Order Status", "Payment Status", "Amount"], ...filtered.map((o) => [shortOrderId(o.orderNumber, o.id), o.createdAt || "", o.tableNumber || o.table?.tableNumber || "", o.orderStatus || o.status || "", o.paymentStatus || "", amount(o)])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `texos-orders-report-${period === "all" ? "all-time" : `${period}-days`}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const maxStatus = Math.max(1, ...stats.statusCounts.map((item) => item.count));
  const maxItem = Math.max(1, ...stats.topItems.map((item) => item.quantity));

  return (
    <section className="reports-page">
      <div className="reports-heading">
        <div><p className="reports-eyebrow">WORKSPACE / REPORTS & ANALYTICS</p><h1>Reports & Analytics</h1><p>Sales, order and menu performance from your restaurant orders.</p></div>
        <div className="reports-actions"><select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Report period"><option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All available orders</option></select><button type="button" onClick={() => loadOrders(true)} disabled={refreshing}>{refreshing ? "Refreshing..." : "↻ Refresh"}</button><button type="button" className="reports-export" onClick={exportCsv} disabled={!filtered.length}>Export CSV</button></div>
      </div>
      {error && <div className="reports-error" role="alert">{error}</div>}
      {loading ? <div className="reports-state">Loading report data from TexOS...</div> : (
        <>
          <div className="reports-kpis">
            <article><span>Paid revenue</span><strong>{money(stats.revenue)}</strong><small>Paid orders only</small></article>
            <article><span>Total orders</span><strong>{stats.total}</strong><small>Orders in selected period</small></article>
            <article><span>Average paid order</span><strong>{money(stats.average)}</strong><small>Revenue ÷ paid orders</small></article>
            <article><span>Pending payments</span><strong>{stats.pending}</strong><small>Awaiting payment</small></article>
          </div>
          <div className="reports-grid">
            <article className="reports-card"><div className="reports-card-heading"><div><h2>Order status</h2><p>Distribution for the selected period</p></div></div>
              {stats.total === 0 ? <p className="reports-empty">No orders found for this period.</p> : <div className="reports-bars">{stats.statusCounts.map((item) => <div className="reports-bar-row" key={item.status}><span>{item.status.replaceAll("_", " ")}</span><div className="reports-bar-track"><i style={{ width: `${(item.count / maxStatus) * 100}%` }} /></div><b>{item.count}</b></div>)}</div>}
            </article>
            <article className="reports-card"><div className="reports-card-heading"><div><h2>Top ordered items</h2><p>Based on item quantities in orders</p></div></div>
              {stats.topItems.length === 0 ? <p className="reports-empty">Item performance will appear when orders arrive.</p> : <div className="reports-bars">{stats.topItems.map((item) => <div className="reports-bar-row" key={item.name}><span title={item.name}>{item.name}</span><div className="reports-bar-track"><i style={{ width: `${(item.quantity / maxItem) * 100}%` }} /></div><b>{item.quantity}</b></div>)}</div>}
            </article>
          </div>
          <article className="reports-card reports-history"><div className="reports-card-heading"><div><h2>Order History</h2><p>{stats.total} orders · {period === "all" ? "All available dates" : period === "1" ? "Today" : `Last ${period} days`}</p></div><span className="reports-period-note">{formatDate(new Date())}</span></div>
            {filtered.length === 0 ? <p className="reports-empty">No orders found for this period.</p> : <div className="reports-table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Table</th><th>Items</th><th>Payment</th><th>Amount</th></tr></thead><tbody>{[...filtered].sort((a,b) => (orderDate(b)?.getTime() || 0) - (orderDate(a)?.getTime() || 0)).map((order) => <tr key={order.id || order.orderNumber}><td>{shortOrderId(order.orderNumber, order.id)}</td><td>{formatDate(orderDate(order))}</td><td>{order.tableNumber || order.table?.tableNumber || "—"}</td><td>{(order.items || []).map((item) => `${item.itemName || "Item"} × ${item.quantity || 1}${item.customization ? ` (Request: ${item.customization})` : ""}`).join(", ") || "—"}</td><td><span className={`reports-payment ${String(order.paymentStatus || "PENDING").toLowerCase()}`}>{order.paymentStatus || "PENDING"}</span></td><td>{money(amount(order))}</td></tr>)}</tbody></table></div>}
          </article>
          <p className="reports-footnote">Reports are calculated from the orders returned by your backend. Revenue includes paid orders only. Date filters use the order timestamps available in the response.</p>
        </>
      )}
    </section>
  );
}
