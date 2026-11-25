import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiFetch, requireRestaurantId, shortOrderId, useActiveRestaurantId } from "./restaurantApi";
import { useLiveUpdates } from "./useLiveUpdates";
import "./Orders.css";


const STATUS_OPTIONS = ["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"];

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  return String(status || "NEW").replaceAll("_", " ");
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

export default function Orders() {
  const restaurantId = useActiveRestaurantId();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const ordersRequestRef = useRef(null);
  const ordersLoadedRef = useRef(false);
  const liveConnectedRef = useRef(false);

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (ordersRequestRef.current) return;
    const controller = new AbortController();
    ordersRequestRef.current = controller;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/orders`,
        { headers: { Accept: "application/json" }, signal: controller.signal }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Could not load orders (HTTP ${response.status})`);
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : data?.content || data?.orders || [];
      if (controller.signal.aborted) return;
      setOrders(list);
      ordersLoadedRef.current = true;
      setSelectedOrder((current) => {
        if (!current) return current;
        return list.find((order) => order.id === current.id) || null;
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(getErrorMessage(err, "Unable to connect to the TexOS backend."));
      }
    } finally {
      if (ordersRequestRef.current === controller) {
        ordersRequestRef.current = null;
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }
  }, [restaurantId]);

  useLiveUpdates({
    enabled: Boolean(restaurantId),
    token: localStorage.getItem("texos-token") || "",
    subscriptions: [{
      destination: `/topic/restaurants/${restaurantId}/live-orders`,
      onMessage: () => loadOrders({ quiet: true }),
    }],
    onConnected: () => {
      if (liveConnectedRef.current || !ordersLoadedRef.current) {
        loadOrders({ quiet: true });
      }
      liveConnectedRef.current = true;
    },
    fallbacks: [{
      intervalMs: 30000,
      callback: () => loadOrders({ quiet: true }),
    }],
  });

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!restaurantId) {
        setOrders([]);
        setSelectedOrder(null);
        setLoading(false);
        return;
      }
      loadOrders();
    });
    return () => {
      active = false;
      ordersRequestRef.current?.abort();
      ordersRequestRef.current = null;
    };
  }, [loadOrders, restaurantId]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const customStart = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const customEnd = toDate ? new Date(`${toDate}T00:00:00`) : null;
    if (customEnd) customEnd.setDate(customEnd.getDate() + 1);
    if (dateFilter === "7") start.setDate(start.getDate() - 6);
    if (dateFilter === "15") start.setDate(start.getDate() - 14);
    if (dateFilter === "30") start.setMonth(start.getMonth() - 1);
    return orders.filter((order) => {
      const itemText = (order.items || [])
        .map((item) => `${item.itemName || ""} ${item.quantity || ""}`)
        .join(" ");
      const matchesSearch = !query || [
        order.orderNumber,
        order.tableNumber,
        order.orderStatus,
        order.paymentStatus,
        itemText,
      ].some((value) => String(value || "").toLowerCase().includes(query));

      const matchesStatus = statusFilter === "ALL" || order.orderStatus === statusFilter;
      const matchesPayment = paymentFilter === "ALL" || order.paymentStatus === paymentFilter;
      const orderDate = new Date(order.createdAt || 0);
      const matchesDate = dateFilter === "ALL" || (dateFilter === "CUSTOM"
        ? (!customStart || orderDate >= customStart) && (!customEnd || orderDate < customEnd)
        : orderDate >= start && orderDate <= endOfToday);
      return matchesSearch && matchesStatus && matchesPayment && matchesDate;
    });
  }, [orders, search, statusFilter, paymentFilter, dateFilter, fromDate, toDate]);

  const counts = useMemo(() => ({
    all: filteredOrders.length,
    active: filteredOrders.filter((order) => ["NEW", "ACCEPTED", "PREPARING", "READY"].includes(order.orderStatus)).length,
    pending: filteredOrders.filter((order) => order.paymentStatus === "PENDING").length,
    paid: filteredOrders.filter((order) => order.paymentStatus === "PAID").length,
  }), [filteredOrders]);

  async function updateStatus(order, newStatus) {
    if (!order?.id || newStatus === order.orderStatus) return;
    setUpdatingOrderId(order.id);
    setError("");

    try {
      const response = await apiFetch(
        `${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/orders/${order.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Status update failed (HTTP ${response.status})`);
      }

      const updated = await response.json().catch(() => null);
      if (updated && typeof updated === "object" && updated.id) {
        setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
        setSelectedOrder(updated);
      } else {
        await loadOrders({ quiet: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not update order status."));
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <section className="orders-page">
      <div className="orders-page-heading">
        <div>
          <p className="orders-eyebrow">WORKSPACE / ORDERS</p>
          <h1>Orders</h1>
          <p className="orders-subtitle">View incoming orders and manage their progress.</p>
        </div>
        <button className="orders-refresh-button" type="button" onClick={() => loadOrders({ quiet: true })} disabled={refreshing}>
          <span aria-hidden="true">↻</span> {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="orders-summary-grid">
        <article><span>All orders</span><strong>{counts.all}</strong></article>
        <article><span>Active orders</span><strong>{counts.active}</strong></article>
        <article><span>Pending payments</span><strong>{counts.pending}</strong></article>
        <article><span>Paid orders</span><strong>{counts.paid}</strong></article>
      </div>

      {error && <div className="orders-error" role="alert">{error}</div>}

      <div className="orders-panel">
        <div className="orders-toolbar">
          <label className="orders-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, table or item..."
              aria-label="Search orders"
            />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by order status">
            <option value="ALL">All order statuses</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} aria-label="Filter by payment status">
            <option value="ALL">All payments</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter by date">
            <option value="ALL">All orders</option><option value="1">Today</option><option value="7">Last 7 days</option><option value="15">Last 15 days</option><option value="30">Last month</option><option value="CUSTOM">Custom dates</option>
          </select>
          {dateFilter === "CUSTOM" && <><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Orders from date"/><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Orders to date"/></>}
        </div>

        {loading ? (
          <div className="orders-state">Loading orders from your restaurant...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="orders-state">
            <strong>No orders found</strong>
            <span>{orders.length ? "Try changing your search or filters." : "New customer orders will appear here."}</span>
          </div>
        ) : (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>ITEMS</th>
                  <th>TABLE</th>
                  <th>AMOUNT</th>
                  <th>PAYMENT</th>
                  <th>STATUS</th>
                  <th>DATE & TIME</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{shortOrderId(order.orderNumber, order.id)}</strong></td>
                    <td>
                      <div className="orders-item-summary">
                        {(order.items || []).slice(0, 2).map((item, index) => (
                          <span key={`${item.itemId || item.itemName}-${index}`}>{item.itemName} × {item.quantity}
                            {item.customization && <small className="orders-item-customization">Request: {item.customization}</small>}
                          </span>
                        ))}
                        {(order.items || []).length > 2 && <small>+{order.items.length - 2} more</small>}
                      </div>
                    </td>
                    <td><span className="orders-table-tag">{order.tableNumber || "—"}</span></td>
                    <td className="orders-money">{formatMoney(order.totalAmount ?? order.bill?.totalAmount)}</td>
                    <td><span className={`orders-payment payment-${String(order.paymentStatus || "PENDING").toLowerCase()}`}>{statusLabel(order.paymentStatus)}</span></td>
                    <td>
                      <select
                        className={`orders-status-select status-${String(order.orderStatus || "NEW").toLowerCase()}`}
                        value={order.orderStatus || "NEW"}
                        disabled={updatingOrderId === order.id || ["SERVED", "CANCELLED"].includes(order.orderStatus)}
                        onChange={(event) => updateStatus(order, event.target.value)}
                        aria-label={`Update status for order ${order.orderNumber || order.id}`}
                      >
                        {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                      </select>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td><button className="orders-view-button" type="button" onClick={() => setSelectedOrder(order)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="orders-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedOrder(null);
        }}>
          <section className="orders-detail-modal" role="dialog" aria-modal="true" aria-labelledby="orders-detail-title">
            <div className="orders-modal-heading">
              <div>
                <p className="orders-eyebrow">ORDER DETAILS</p>
                <h2 id="orders-detail-title">{shortOrderId(selectedOrder.orderNumber, selectedOrder.id)}</h2>
                <span>{selectedOrder.tableNumber || "Table not specified"} · {formatDate(selectedOrder.createdAt)}</span>
              </div>
              <button type="button" className="orders-close-button" onClick={() => setSelectedOrder(null)} aria-label="Close order details">×</button>
            </div>
            <div className="orders-detail-items">
              {(selectedOrder.items || []).map((item, index) => (
                <div className="orders-detail-line" key={`${item.itemId || item.itemName}-${index}`}>
                  <div><strong>{item.itemName}</strong><span>{formatMoney(item.unitPrice)} × {item.quantity}</span>
                    {item.customization && <small className="orders-item-customization">Request: {item.customization}</small>}
                  </div>
                  <strong>{formatMoney(item.lineTotal)}</strong>
                </div>
              ))}
            </div>
            <div className="orders-detail-total"><span>Order total</span><strong>{formatMoney(selectedOrder.totalAmount ?? selectedOrder.bill?.totalAmount)}</strong></div>
            <div className="orders-detail-meta">
              <span>Order status: <b>{statusLabel(selectedOrder.orderStatus)}</b></span>
              <span>Payment: <b>{statusLabel(selectedOrder.paymentStatus)}</b></span>
            </div>
            <div className="orders-modal-actions">
              <button type="button" className="orders-primary-button" onClick={() => setSelectedOrder(null)}>Done</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
