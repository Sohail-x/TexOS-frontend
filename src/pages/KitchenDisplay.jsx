import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch, requireRestaurantId, shortOrderId, useActiveRestaurantId } from "./restaurantApi";
import "./KitchenDisplay.css";

const LANES = [
  { status: "NEW", title: "New orders", next: "ACCEPTED", action: "Accept order" },
  { status: "ACCEPTED", title: "Accepted", next: "PREPARING", action: "Start preparing" },
  { status: "PREPARING", title: "Preparing", next: "READY", action: "Mark as ready" },
  { status: "READY", title: "Ready to serve", next: null, action: null },
];

function getStatus(order) {
  return String(order?.orderStatus || order?.status || "NEW").toUpperCase();
}
function formatMoney(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}
function elapsed(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min ago`;
}
function unwrap(data) {
  if (Array.isArray(data)) return data;
  return data?.content || data?.orders || data?.data || [];
}

function getDismissedOrderIds(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved.map(String) : [];
  } catch {
    return [];
  }
}

export default function KitchenDisplay({
  staffMode = false,
  staffToken = "",
  staffRestaurantId = "",
  onStaffLogout,
  onStaffAccessRevoked,
}) {
  const ownerRestaurantId = useActiveRestaurantId();
  const restaurantId = staffMode ? staffRestaurantId : ownerRestaurantId;
  const dismissalStorageKey = `texos-kitchen-dismissed-${restaurantId}-${staffMode ? "staff" : "owner"}`;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [eraseDialogOpen, setEraseDialogOpen] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [dismissalState, setDismissalState] = useState(() => ({
    storageKey: dismissalStorageKey,
    orderIds: getDismissedOrderIds(dismissalStorageKey),
  }));
  const dismissedOrderIds = dismissalState.storageKey === dismissalStorageKey
    ? dismissalState.orderIds
    : getDismissedOrderIds(dismissalStorageKey);

  const kitchenFetch = useCallback((path, options = {}) => {
    if (!staffMode) return apiFetch(path, options);
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${staffToken}`,
        ...options.headers,
      },
    });
  }, [staffMode, staffToken]);

  const loadOrders = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const path = staffMode
        ? "/api/kitchen-staff/orders"
        : `${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/orders`;
      const response = await kitchenFetch(path, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (staffMode && [401, 403].includes(response.status)) {
          setOrders([]);
          onStaffAccessRevoked?.();
        }
        throw new Error(body?.message || `Unable to load kitchen orders (HTTP ${response.status})`);
      }
      setOrders(unwrap(await response.json()));
      setError("");
      setLastSynced(new Date());
    } catch (err) {
      setError(err.message || "Could not connect to TexOS backend.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kitchenFetch, onStaffAccessRevoked, restaurantId, staffMode]);

  useEffect(() => {
    let active = true;
    let timer;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!restaurantId) {
        setOrders([]);
        setLoading(false);
        return;
      }
      loadOrders();
      timer = window.setInterval(() => loadOrders(true), 10000);
    });
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [kitchenFetch, loadOrders, restaurantId, staffMode]);

  const activeOrders = useMemo(() => orders.filter((order) => ["NEW", "ACCEPTED", "PREPARING", "READY"].includes(getStatus(order)) && !dismissedOrderIds.includes(String(order.id))), [orders, dismissedOrderIds]);
  const filteredActiveOrders = useMemo(() => statusFilter === "ALL" ? activeOrders : activeOrders.filter((order) => getStatus(order) === statusFilter), [activeOrders, statusFilter]);
  const filterLabel = { ALL: "All orders", NEW: "New orders", ACCEPTED: "Accepted", PREPARING: "Preparing", READY: "Ready to serve" }[statusFilter];

  async function changeStatus(order, nextStatus) {
    if (!order?.id || !nextStatus) return;
    setUpdatingId(order.id);
    setError("");
    try {
      const path = staffMode
        ? `/api/kitchen-staff/orders/${order.id}/status`
        : `${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/orders/${order.id}/status`;
      const response = await kitchenFetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (staffMode && [401, 403].includes(response.status)) {
          setOrders([]);
          onStaffAccessRevoked?.();
        }
        throw new Error(body?.message || `Could not update order (HTTP ${response.status})`);
      }
      await loadOrders(true);
    } catch (err) {
      setError(err.message || "Order status update failed.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function eraseAllOrders() {
    setErasing(true);
    try {
      if (staffMode) {
        const response = await kitchenFetch("/api/kitchen-staff/me", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            setOrders([]);
            onStaffAccessRevoked?.();
          }
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || `Kitchen access is no longer active (HTTP ${response.status}).`);
        }
      }
      const dismissed = [...new Set([...dismissedOrderIds, ...activeOrders.map((order) => String(order.id))])];
      localStorage.setItem(dismissalStorageKey, JSON.stringify(dismissed));
      setDismissalState({ storageKey: dismissalStorageKey, orderIds: dismissed });
      setEraseDialogOpen(false);
      setLastSynced(new Date());
    } catch (err) {
      setError(err.message || "Could not clear the kitchen display.");
    } finally {
      setErasing(false);
    }
  }

  return (
    <section className="kitchen-page">
      <div className="kitchen-heading">
        <div><p className="kitchen-eyebrow">{staffMode ? "TEXOS / KITCHEN STAFF" : "WORKSPACE / KITCHEN"}</p><h1>{staffMode ? "Kitchen Staff Portal" : "Kitchen Display"}</h1><p>Track incoming orders and move them through preparation.</p></div>
        {staffMode && <button className="kitchen-refresh" type="button" onClick={onStaffLogout}>Sign out</button>}
        <div className="kitchen-heading-actions"><button className="kitchen-erase-button" type="button" onClick={() => setEraseDialogOpen(true)} disabled={loading || erasing || orders.length === 0}>Erase all orders</button><button className="kitchen-refresh" type="button" onClick={() => loadOrders(true)} disabled={refreshing || erasing}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button><select className="kitchen-status-filter" aria-label="Filter kitchen orders by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All orders</option><option value="NEW">New orders</option><option value="ACCEPTED">Accepted</option><option value="PREPARING">Preparing</option><option value="READY">Ready to serve</option></select></div>
      </div>
      <div className="kitchen-statusbar"><span><i /> Live order board</span><span>{filteredActiveOrders.length} active {filteredActiveOrders.length === 1 ? "order" : "orders"}</span>{statusFilter !== "ALL" && <span>Showing: {filterLabel}</span>}<span>Auto refresh: 10 sec</span><span>Last sync: {lastSynced ? lastSynced.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</span></div>
      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {loading ? <div className="kitchen-empty">Loading kitchen orders…</div> : filteredActiveOrders.length === 0 ? <div className="kitchen-empty"><strong>{activeOrders.length === 0 ? "Kitchen is all clear" : "No orders match this filter"}</strong><span>{activeOrders.length === 0 ? "New customer orders will appear here automatically." : "Choose another status to view active kitchen orders."}</span></div> : (
        <div className="kitchen-board">
          {LANES.map((lane) => {
            const laneOrders = filteredActiveOrders.filter((order) => getStatus(order) === lane.status).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            return <section className={`kitchen-lane lane-${lane.status.toLowerCase()}`} key={lane.status}>
              <header><div><h2>{lane.title}</h2><span>{laneOrders.length} {laneOrders.length === 1 ? "order" : "orders"}</span></div><b>{laneOrders.length}</b></header>
              <div className="kitchen-lane-content">
                {laneOrders.length === 0 ? <p className="kitchen-lane-empty">No orders</p> : laneOrders.map((order) => (
                  <article className="kitchen-order-card" key={order.id}>
                    <div className="kitchen-order-top"><strong>{shortOrderId(order.orderNumber, order.id)}</strong><span>{order.tableNumber || "Table —"}</span></div>
                    <p className="kitchen-order-time">Received {elapsed(order.createdAt)}</p>
                    <div className="kitchen-items">{(order.items || []).map((item, index) => <div className="kitchen-item" key={`${item.itemId || item.itemName || "item"}-${index}`}><b>{item.quantity || 1}×</b><span>{item.itemName || "Menu item"}{item.customization && <small className="kitchen-item-customization">Request: {item.customization}</small>}</span></div>)}</div>
                    {order.specialInstructions && <p className="kitchen-note">Note: {order.specialInstructions}</p>}
                    <div className="kitchen-card-footer"><span>{formatMoney(order.totalAmount ?? order.bill?.totalAmount)}</span>{lane.next && <button type="button" disabled={updatingId === order.id} onClick={() => changeStatus(order, lane.next)}>{updatingId === order.id ? "Updating…" : lane.action} →</button>}</div>
                    {lane.status === "READY" && <p className="kitchen-ready-hint">Waiting for service staff to serve this order.</p>}
                  </article>
                ))}
              </div>
            </section>;
          })}
        </div>
      )}
      {eraseDialogOpen && <div className="kitchen-erase-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !erasing) setEraseDialogOpen(false); }}><section className="kitchen-erase-dialog" role="dialog" aria-modal="true" aria-labelledby="erase-orders-title"><div className="kitchen-erase-warning">!</div><h2 id="erase-orders-title">Clear Kitchen Display?</h2><p>{staffMode ? "This clears orders only from this staff display on this device. It will not remove orders from the owner’s kitchen display or order records." : "Are you sure you want to erase all orders from this Kitchen Display? Orders and bills will remain available in their respective pages."}</p><div><button type="button" className="kitchen-erase-cancel" disabled={erasing} onClick={() => setEraseDialogOpen(false)}>Cancel</button><button type="button" className="kitchen-erase-confirm" disabled={erasing} onClick={eraseAllOrders}>{erasing ? "Clearing…" : "Yes, clear display"}</button></div></section></div>}
    </section>
  );
}
